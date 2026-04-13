// src/print2/PrintRenderer.tsx
import React, { useMemo } from "react";
import type { ColumnDef } from "../core/TableTypes";
import type { PrintModel, PrintRow, PrintBar, PrintDepLine } from "./PrintTypes";

type PrintLayoutMode = "full" | "table" | "gantt";

type Props = {
  model: PrintModel;
  mode?: PrintLayoutMode;

  logoSrc?: string;
  headerLeftLines?: string[];
  headerRightLines?: string[];

  watermarkText?: string;
  watermarkSvgSrc?: string;
  showWatermark?: boolean;

  title?: string;
  locale?: string;

  showBarLabels?: boolean;
  barLabelKey?: string;
};

const GRID_LINE = "rgba(0,0,0,0.16)";
const GRID_LINE_LIGHT = "rgba(0,0,0,0.10)";
const TEXT = "rgba(0,0,0,0.92)";

const snap = (n: number) => Math.round(n);

const LEFT_GUTTER_PX = 8;
const RIGHT_GUTTER_PX = 8;

const BAR_RX = 3;
const BAR_STROKE_W = 1;
const DEFAULT_BAR_FILL = "#a78666";
const BAR_EDGE_INSET = BAR_RX + BAR_STROKE_W + 1;

const ARROW_HEAD_LEN = 6;
const ARROW_HEAD_W = 4;

const DEP_END_PAD = 0;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map((x) => Number(x));
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function addDays(dt: Date, days: number): Date {
  const x = new Date(dt);
  x.setDate(x.getDate() + days);
  x.setHours(0, 0, 0, 0);
  return x;
}

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(1);
  return x;
}

function startOfYear(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setMonth(0, 1);
  return x;
}

function addMonths(d: Date, months: number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setMonth(x.getMonth() + months, 1);
  return x;
}

function addYears(d: Date, years: number): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setFullYear(x.getFullYear() + years);
  x.setMonth(0, 1);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function isoWeekNumber(d: Date): number {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + 3 - ((dt.getDay() + 6) % 7));
  const week1 = new Date(dt.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((dt.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}

function yearLabel(d: Date): string {
  return String(d.getFullYear());
}

function formatDayLabel(d: Date): string {
  return pad2(d.getDate());
}

function safeText(s: any): string {
  return String(s ?? "").trim();
}

function isPrintableVisibleColumn(c: ColumnDef): boolean {
  const x: any = c;
  if (x?.visible === false) return false;
  if (x?.hidden === true) return false;
  if (x?.isHidden === true) return false;
  if (x?.show === false) return false;
  if (x?.isVisible === false) return false;
  return true;
}

function computeVisibleColumns(columns: ColumnDef[], rows: PrintRow[]): ColumnDef[] {
  const hasAny = (key: string) => rows.some((r) => safeText(r.cells[key]));
  return columns.filter((c) => {
    if (!isPrintableVisibleColumn(c)) return false;
    return c.dateRole === "start" || c.dateRole === "end" || hasAny(c.key);
  });
}

function reorderColumnsForPrint(columns: ColumnDef[]): ColumnDef[] {
  // Print skal respektere nøyaktig den rekkefølgen kolonnene kommer inn i.
  return columns;
}

function splitIntoPages<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += pageSize) out.push(items.slice(i, i + pageSize));
  return out;
}

function filterBarsForPage(bars: PrintBar[], pageRowIds: Set<string>): PrintBar[] {
  return bars.filter((b) => pageRowIds.has(b.rowId));
}

function filterDepsForPage(lines: PrintDepLine[], pageRowIds: Set<string>): PrintDepLine[] {
  return lines.filter((l) => pageRowIds.has(l.fromRowId) && pageRowIds.has(l.toRowId));
}

const MONTHS_NO = ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function normalizeLocaleKey(loc: any): "no" | "en" {
  const s = String(loc ?? "").trim().toLowerCase();
  if (!s) return "en";
  if (s.startsWith("en")) return "en";
  if (s.startsWith("nb") || s.startsWith("nn") || s.startsWith("no")) return "no";
  return "en";
}

function monthShort(d: Date, localeKey: "no" | "en"): string {
  const arr = localeKey === "no" ? MONTHS_NO : MONTHS_EN;
  return arr[d.getMonth()] ?? String(d.getMonth() + 1);
}

function monthWithYear(d: Date, localeKey: "no" | "en"): string {
  return `${monthShort(d, localeKey)} ${d.getFullYear()}`;
}

function weekPrefix(localeKey: "no" | "en"): string {
  return localeKey === "no" ? "uke" : "week";
}

function buildAxisBands(
  model: PrintModel,
  ganttW: number,
  pxPerDay: number,
  leftGutter: number,
  rightGutter: number,
  localeKey: "no" | "en"
) {
  const start = parseISO(model.range.startISO);
  const totalDays = model.range.totalDays;
  const scale = model.layout.scale;

  const timeW = Math.max(1, ganttW - leftGutter - rightGutter);

  type Tick = { x: number; label?: string; major: boolean };
  const bandH = 18;

  const xForDayIndex = (dayIndex: number) => leftGutter + dayIndex * pxPerDay;

  const pushEndTicks = (ticks: Tick[]) => {
    ticks.push({ x: snap(leftGutter + timeW), major: true });
    ticks.push({ x: snap(ganttW), major: true });
  };

  const mkTicksDay = (): Tick[] => {
    const ticks: Tick[] = [];
    for (let i = 0; i <= totalDays; i++) {
      const x = xForDayIndex(i);
      if (x > leftGutter + timeW + 0.5) break;
      const d = addDays(start, i);
      ticks.push({ x, major: true, label: formatDayLabel(d) });
    }
    pushEndTicks(ticks);
    return ticks;
  };

  const mkTicksWeek = (): Tick[] => {
    const ticks: Tick[] = [];
    const s = new Date(start);
    const sDay = (s.getDay() + 6) % 7;
    const firstMonday = addDays(s, (7 - sDay) % 7);

    ticks.push({ x: snap(leftGutter), major: true });

    for (let d = new Date(firstMonday); ; d = addDays(d, 7)) {
      const di = daysBetween(start, d);
      if (di < 0) continue;
      const x = xForDayIndex(di);
      if (x > leftGutter + timeW + 0.5) break;

      ticks.push({
        x: snap(x),
        major: true,
        label: `${weekPrefix(localeKey)} ${isoWeekNumber(d)}`,
      });
    }

    pushEndTicks(ticks);
    return ticks;
  };

  const mkTicksMonth = (withYearInLabel: boolean): Tick[] => {
    const ticks: Tick[] = [];
    ticks.push({
      x: snap(leftGutter),
      major: true,
      label: withYearInLabel ? monthWithYear(start, localeKey) : monthShort(start, localeKey),
    });

    let m = addMonths(startOfMonth(start), 1);
    for (;; m = addMonths(m, 1)) {
      const di = daysBetween(start, m);
      const x = xForDayIndex(di);
      if (x > leftGutter + timeW + 0.5) break;

      ticks.push({
        x: snap(x),
        major: true,
        label: withYearInLabel ? monthWithYear(m, localeKey) : monthShort(m, localeKey),
      });
    }

    pushEndTicks(ticks);
    return ticks;
  };

  const mkTicksYear = (): Tick[] => {
    const ticks: Tick[] = [];
    ticks.push({ x: snap(leftGutter), major: true, label: yearLabel(start) });

    let y = addYears(startOfYear(start), 1);
    for (;; y = addYears(y, 1)) {
      const di = daysBetween(start, y);
      const x = xForDayIndex(di);
      if (x > leftGutter + timeW + 0.5) break;
      ticks.push({ x: snap(x), major: true, label: yearLabel(y) });
    }

    pushEndTicks(ticks);
    return ticks;
  };

  let bandsSpec: Array<"day" | "week" | "month" | "year"> = [];
  if (scale === "day") bandsSpec = ["month", "week", "day"];
  else if (scale === "week") bandsSpec = ["year", "month", "week"];
  else if (scale === "month") bandsSpec = ["year", "month"];
  else bandsSpec = ["year"];

  const bands: any[] = [];
  for (let i = 0; i < bandsSpec.length; i++) {
    const y0 = i * bandH;
    const y1 = y0 + bandH;

    const kind = bandsSpec[i];
    let ticks: any[] = [];

    if (kind === "day") ticks = mkTicksDay();
    else if (kind === "week") ticks = mkTicksWeek();
    else if (kind === "month") ticks = mkTicksMonth(scale === "day");
    else ticks = mkTicksYear();

    bands.push({
      ticks,
      y0,
      y1,
      labelY: y0 + 13,
      fontSize: 10,
    });
  }

  return { bands, bandH };
}

function GanttAxisMulti({
  model,
  ganttW,
  height,
  pxPerDay,
  leftGutter,
  rightGutter,
  localeKey,
}: {
  model: PrintModel;
  ganttW: number;
  height: number;
  pxPerDay: number;
  leftGutter: number;
  rightGutter: number;
  localeKey: "no" | "en";
}) {
  const { bands, bandH } = useMemo(
    () => buildAxisBands(model, ganttW, pxPerDay, leftGutter, rightGutter, localeKey),
    [model, ganttW, pxPerDay, leftGutter, rightGutter, localeKey]
  );

  return (
    <svg width={ganttW} height={height} style={{ display: "block" }}>
      <rect x={0} y={0} width={ganttW} height={height} fill={"rgba(0,0,0,0.02)"} />
      <line x1={0} y1={0} x2={ganttW} y2={0} stroke={GRID_LINE} strokeWidth={1} />
      <line x1={0} y1={height} x2={ganttW} y2={height} stroke={GRID_LINE} strokeWidth={1} />

      {bands.map((band: any, bi: number) => (
        <g key={bi}>
          <line x1={0} y1={band.y1} x2={ganttW} y2={band.y1} stroke={GRID_LINE} strokeWidth={1} />

          {band.ticks.map((t: any, idx: number) => {
            const y1 = t.major ? band.y0 : band.y0 + bandH / 2;
            const y2 = band.y1;

            return (
              <g key={idx}>
                <line
                  x1={t.x}
                  y1={y1}
                  x2={t.x}
                  y2={y2}
                  stroke={t.major ? GRID_LINE : GRID_LINE_LIGHT}
                  strokeWidth={1}
                />
                {t.label ? (
                  <text x={t.x + 3} y={band.labelY} fontSize={band.fontSize} fill={TEXT}>
                    {t.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function computeArrowPolygon(points: Array<{ x: number; y: number }>) {
  if (!points.length) return null;
  const last = points[points.length - 1];

  let prev = last;
  for (let i = points.length - 2; i >= 0; i--) {
    const p = points[i];
    if (p.x !== last.x || p.y !== last.y) {
      prev = p;
      break;
    }
  }

  const dx = last.x - prev.x;
  const dy = last.y - prev.y;
  const len = Math.max(1, Math.hypot(dx, dy));
  const ux = dx / len;
  const uy = dy / len;

  const ax = last.x - ux * ARROW_HEAD_LEN;
  const ay = last.y - uy * ARROW_HEAD_LEN;

  const left = { x: ax + -uy * ARROW_HEAD_W, y: ay + ux * ARROW_HEAD_W };
  const right = { x: ax + uy * ARROW_HEAD_W, y: ay + -ux * ARROW_HEAD_W };

  return { tip: last, left, right };
}

function SvgDepLines({ lines }: { lines: PrintDepLine[] }) {
  return (
    <>
      {lines.map((l, idx) => {
        const pts = l.points.map((p) => `${p.x},${p.y}`).join(" ");
        const col = l.valid ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.25)";
        return <polyline key={idx} points={pts} fill="none" stroke={col} strokeWidth={1} />;
      })}
    </>
  );
}

function SvgDepArrowHeads({ lines }: { lines: PrintDepLine[] }) {
  return (
    <>
      {lines.map((l, idx) => {
        const poly = computeArrowPolygon(l.points);
        if (!poly) return null;
        const col = l.valid ? "rgba(0,0,0,0.70)" : "rgba(0,0,0,0.30)";
        const pts = `${poly.tip.x},${poly.tip.y} ${poly.left.x},${poly.left.y} ${poly.right.x},${poly.right.y}`;
        return <polygon key={idx} points={pts} fill={col} />;
      })}
    </>
  );
}

function estimateTextPx(text: string, pxPerChar = 6): number {
  const t = String(text ?? "");
  return t.length * pxPerChar;
}

function estimateLabelWidth(text: string): number {
  const t = String(text ?? "");
  return t.length * 5.8 + 6;
}

function SvgBars({
  bars,
  showLabels,
  labelByRowId,
  rightLimit,
}: {
  bars: PrintBar[];
  showLabels: boolean;
  labelByRowId: Record<string, string>;
  rightLimit: number;
}) {
  return (
    <>
      {bars.map((b, idx) => {
        const label = showLabels ? (labelByRowId[b.rowId] ?? "") : "";

        if (b.isMilestone) {
          const cx = b.x + b.w / 2;
          const cy = b.y + b.h / 2;
          const half = Math.max(4, b.h / 2);

          const pts = [
            `${cx},${cy - half}`,
            `${cx + half},${cy}`,
            `${cx},${cy + half}`,
            `${cx - half},${cy}`,
          ].join(" ");

          const labelW = estimateLabelWidth(label);
          const gap = 6;

          const rightX = cx + half + gap;
          const leftX = cx - half - gap;

          const rightFits = rightX + labelW <= rightLimit;

          return (
            <g key={idx}>
              <polygon
                points={pts}
                fill={b.color || DEFAULT_BAR_FILL}
                stroke={b.color ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.18)"}
                strokeWidth={BAR_STROKE_W}
              />

              {showLabels && label ? (
                rightFits ? (
                  <text
                    x={rightX}
                    y={cy + 3}
                    fontSize={9.5}
                    fontWeight={600}
                    fill={"rgba(0,0,0,0.85)"}
                    textAnchor="start"
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                ) : (
                  <text
                    x={leftX}
                    y={cy + 3}
                    fontSize={9.5}
                    fontWeight={600}
                    fill={"rgba(0,0,0,0.85)"}
                    textAnchor="end"
                    style={{ pointerEvents: "none" }}
                  >
                    {label}
                  </text>
                )
              ) : null}
            </g>
          );
        }

        return (
          <g key={idx}>
            <rect
              x={b.x}
              y={b.y}
              width={Math.max(1, b.w)}
              height={Math.max(1, b.h)}
              rx={BAR_RX}
              ry={BAR_RX}
              fill={b.color || DEFAULT_BAR_FILL}
              stroke={b.color ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.18)"}
              strokeWidth={BAR_STROKE_W}
            />
            {showLabels && label
              ? (() => {
                  const labelW = estimateLabelWidth(label);
                  const padding = 12;
                  const fitsInside = !b.isMilestone && labelW <= b.w - padding;

                  const insideTy = b.y + b.h / 2 + 3;
                  const outsideTy = b.y + b.h / 2 - 1;

                  if (fitsInside) {
                    const tx = b.x + 6;
                    const clipId = `barclip-${idx}`;

                    return (
                      <>
                        <clipPath id={clipId}>
                          <rect
                            x={b.x}
                            y={b.y}
                            width={Math.max(1, b.w)}
                            height={Math.max(1, b.h)}
                            rx={BAR_RX}
                            ry={BAR_RX}
                          />
                        </clipPath>
                        <text
                          x={tx}
                          y={insideTy}
                          clipPath={`url(#${clipId})`}
                          fontSize={9.5}
                          fontWeight={700}
                          fill={"rgba(255,255,255,0.92)"}
                          style={{ pointerEvents: "none" }}
                        >
                          {label}
                        </text>
                      </>
                    );
                  }

                  const gap = 6;
                  const rightX = b.x + b.w + gap;
                  const rightFits = rightX + labelW <= rightLimit;

                  if (rightFits) {
                    return (
                      <text
                        x={rightX}
                        y={outsideTy}
                        fontSize={9.5}
                        fontWeight={600}
                        fill={"rgba(0,0,0,0.85)"}
                        textAnchor="start"
                        style={{ pointerEvents: "none" }}
                      >
                        {label}
                      </text>
                    );
                  }

                  const leftX = b.x - gap;

                  return (
                    <text
                      x={leftX}
                      y={outsideTy}
                      fontSize={9.5}
                      fontWeight={600}
                      fill={"rgba(0,0,0,0.85)"}
                      textAnchor="end"
                      style={{ pointerEvents: "none" }}
                    >
                      {label}
                    </text>
                  );
                })()
              : null}
          </g>
        );
      })}
    </>
  );
}

function computeAutoColumnWidths(
  columns: ColumnDef[],
  rows: PrintRow[],
  opts: { maxTableW: number; fontPxPerChar?: number }
) {
  const pxPerChar = opts.fontPxPerChar ?? 6;

  const minWByKey = new Map<string, number>();
  const maxWByKey = new Map<string, number>();

  for (const c of columns) {
    let minW = 48;
    let maxW = 420;

    if (c.dateRole === "start" || c.dateRole === "end") {
      minW = 78;
      maxW = 110;
    } else if (
      c.key.toLowerCase().includes("varighet") ||
      c.title.toLowerCase().includes("varighet")
    ) {
      minW = 58;
      maxW = 90;
    }

    minWByKey.set(c.key, minW);
    maxWByKey.set(c.key, maxW);
  }

  const firstKey = columns[0]?.key;
  let maxIndent = 0;
  for (const r of rows) maxIndent = Math.max(maxIndent, (r.indent ?? 0) as any);
  const indentExtra = firstKey ? maxIndent * 12 : 0;

  const raw: number[] = columns.map((c, idx) => {
    const titlePx = estimateTextPx(c.title, pxPerChar) + 18;
    let cellMaxPx = 0;

    for (const r of rows) {
      const v = String((r as any).cells?.[c.key] ?? "");
      cellMaxPx = Math.max(cellMaxPx, estimateTextPx(v, pxPerChar) + 18);
    }

    let w = Math.max(titlePx, cellMaxPx);
    if (idx === 0) w += indentExtra;

    const minW = minWByKey.get(c.key) ?? 48;
    const maxW = maxWByKey.get(c.key) ?? 420;

    w = Math.max(minW, Math.min(maxW, Math.round(w)));
    return w;
  });

  const maxTableW = Math.max(200, Math.floor(opts.maxTableW));
  const sum = raw.reduce((a, b) => a + b, 0);
  if (sum <= maxTableW) return { widths: raw, tableW: sum };

  const mins = columns.map((c) => minWByKey.get(c.key) ?? 48);
  const minSum = mins.reduce((a, b) => a + b, 0);
  if (minSum >= maxTableW) return { widths: mins, tableW: minSum };

  const extra = sum - minSum;
  const targetExtra = maxTableW - minSum;
  const k = targetExtra / extra;

  const scaled = raw.map((w, i) => {
    const base = mins[i];
    const e = w - base;
    return Math.round(base + e * k);
  });

  return { widths: scaled, tableW: scaled.reduce((a, b) => a + b, 0) };
}

function computeHasChildrenMap(rows: PrintRow[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (let i = 0; i < rows.length; i++) {
    const cur = rows[i];
    const next = rows[i + 1];
    out[cur.id] = Boolean(next && (next.indent ?? 0) > (cur.indent ?? 0));
  }
  return out;
}

function PrintTable({
  columns,
  rows,
  colWidths,
  rowHeightPx,
  headerRowHeightPx,
}: {
  columns: ColumnDef[];
  rows: PrintRow[];
  colWidths: number[];
  rowHeightPx: number;
  headerRowHeightPx: number;
}) {
  const widths = colWidths;
  const hasChildrenById = useMemo(() => computeHasChildrenMap(rows), [rows]);

  const cellBase: React.CSSProperties = {
    padding: 0,
    margin: 0,
    boxSizing: "border-box",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    verticalAlign: "middle",
  };

  const bodyCell: React.CSSProperties = {
    ...cellBase,
    height: rowHeightPx,
    lineHeight: `${rowHeightPx}px`,
    borderLeft: `1px solid ${GRID_LINE_LIGHT}`,
    borderRight: `1px solid ${GRID_LINE_LIGHT}`,
  };

  const headCell: React.CSSProperties = {
    ...cellBase,
    height: headerRowHeightPx,
    lineHeight: `${headerRowHeightPx}px`,
    borderLeft: `1px solid ${GRID_LINE}`,
    borderRight: `1px solid ${GRID_LINE}`,
    background: "rgba(0,0,0,0.03)",
    fontWeight: 700,
    textAlign: "left",
  };

  const sumW = widths.reduce((a, b) => a + b, 0);

  return (
    <table
      style={{
        width: sumW,
        borderCollapse: "collapse",
        tableLayout: "fixed",
        fontSize: 10.5,
        color: TEXT,
      }}
    >
      <thead>
        <tr style={{ height: headerRowHeightPx }}>
          {columns.map((c, i) => (
            <th key={c.key} style={{ ...headCell, width: widths[i] }} title={c.title}>
              <div
                style={{
                  height: headerRowHeightPx,
                  display: "flex",
                  alignItems: "center",
                  padding: "0 6px",
                  lineHeight: 1.1,
                }}
              >
                <span style={{ fontWeight: 700 }}>{c.title}</span>
              </div>
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {rows.map((r: PrintRow) => {
          const indent = Math.max(0, Number(r.indent ?? 0));
          const hasChildren = Boolean(hasChildrenById[r.id]);

          const rowTextStyle: React.CSSProperties =
            indent > 0 && hasChildren
              ? { fontWeight: 700, fontStyle: "italic" }
              : hasChildren
              ? { fontWeight: 700, fontStyle: "normal" }
              : indent > 0
              ? { fontWeight: 400, fontStyle: "italic" }
              : { fontWeight: 400, fontStyle: "normal" };

          return (
            <tr key={r.id} style={{ height: rowHeightPx }}>
              {columns.map((c, i) => {
                const raw = safeText(r.cells[c.key]);
                const indentPad = c.key === columns[0]?.key ? indent * 12 : 0;

                return (
                  <td key={c.key} style={{ ...bodyCell, width: widths[i] }} title={raw}>
                    <div
                      style={{
                        height: rowHeightPx,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 6px",
                        lineHeight: 1.1,
                        ...rowTextStyle,
                      }}
                    >
                      <span style={{ display: "inline-block", paddingLeft: indentPad }}>
                        {raw}
                      </span>
                    </div>
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default function PrintRenderer({
  model,
  mode = "full",
  logoSrc,
  headerLeftLines,
  watermarkText,
  watermarkSvgSrc,
  showWatermark,
  title,
  locale,
  showBarLabels,
  barLabelKey,
}: Props) {
  const { pagePx, contentPx, rowHeightPx } = model.layout;

  const showTable = mode === "full" || mode === "table";
  const showGantt = mode === "full" || mode === "gantt";

  const headerHeight = 64;
  const footerHeight = 28;
  const headerRowHeight = 54;

  const contentTop = contentPx.y + headerHeight;
  const contentHeight = contentPx.h - headerHeight - footerHeight;

  const visibleColumns = useMemo(() => {
    return computeVisibleColumns(model.columns, model.rows);
  }, [model.columns, model.rows]);

  const rowsPerPage = Math.max(1, Math.floor((contentHeight - headerRowHeight) / rowHeightPx));
  const pages = useMemo(() => splitIntoPages(model.rows, rowsPerPage), [model.rows, rowsPerPage]);

  const centerTitle = (title ?? "").trim() || "Prosjektnavn (ikke satt)";
  const localeKey = normalizeLocaleKey(locale);

  return (
    <div style={{ width: pagePx.w, background: "white", color: TEXT }}>
      {pages.map((pageRows, pageIndex) => {
        const pageRowIds = new Set(pageRows.map((r) => (r as any).id));

        const pageBarsRaw = filterBarsForPage(model.bars, pageRowIds);
        const pageDepsRaw =
          model.options.includeDependencies && showGantt
            ? filterDepsForPage(model.depLines, pageRowIds)
            : [];

        const minGanttW = 520;
        const maxTableW = Math.max(240, contentPx.w - minGanttW);

        const auto = showTable
          ? computeAutoColumnWidths(visibleColumns, model.rows, { maxTableW })
          : { widths: [] as number[], tableW: 0 };

        const pageTableW = showTable
          ? showGantt
            ? auto.tableW
            : contentPx.w
          : 0;

        const ganttLeft = pageTableW;
        const baseGanttX = model.layout.ganttPx.x;

        const pageGanttW = showGantt
          ? showTable
            ? Math.max(120, contentPx.w - pageTableW)
            : contentPx.w
          : 0;

        const innerTimeW = showGantt
          ? Math.max(40, pageGanttW - LEFT_GUTTER_PX - RIGHT_GUTTER_PX)
          : 0;

        const baseExpectedW = Math.max(1, model.range.totalDays * model.layout.pxPerDay);
        const sx = showGantt
          ? Math.round((innerTimeW / baseExpectedW) * 1000) / 1000
          : 1;

        const pxPerDayScaled = model.layout.pxPerDay * sx;

        const leftLimit = snap(ganttLeft + LEFT_GUTTER_PX);
        const rightLimit = snap(ganttLeft + pageGanttW - RIGHT_GUTTER_PX - BAR_EDGE_INSET);

        const rowIndexById = new Map<string, number>();
        pageRows.forEach((r: any, i: number) => rowIndexById.set(r.id, i));

        const pageBars: PrintBar[] = showGantt
          ? pageBarsRaw.map((b) => {
              const i = rowIndexById.get(b.rowId) ?? 0;
              const yCenter = headerRowHeight + i * rowHeightPx + (rowHeightPx - b.h) / 2;

              if (b.isMilestone) {
                const baseCenterX = b.x + b.w / 2;
                const scaledCenterX =
                  ganttLeft + LEFT_GUTTER_PX + (baseCenterX - baseGanttX) * sx;

                const size = Math.max(8, snap(b.h));
                let x = snap(scaledCenterX - size / 2);

                x = Math.max(x, leftLimit);
                x = Math.min(x, rightLimit - size);

                return {
                  ...b,
                  x,
                  y: snap(yCenter),
                  w: size,
                  h: size,
                };
              }

              const x1 = ganttLeft + LEFT_GUTTER_PX + (b.x - baseGanttX) * sx;
              const x2 = ganttLeft + LEFT_GUTTER_PX + (b.x + b.w - baseGanttX) * sx;

              let sx1 = snap(x1);
              let sx2 = snap(x2);

              sx1 = Math.max(sx1, leftLimit);
              sx2 = Math.min(sx2, rightLimit);

              return {
                ...b,
                x: sx1,
                w: Math.max(1, sx2 - sx1),
                y: snap(yCenter),
              };
            })
          : [];

        const labelKey = (barLabelKey ?? visibleColumns?.[0]?.key ?? "").trim();
        const labelByRowId: Record<string, string> = {};
        for (const r of model.rows) {
          labelByRowId[r.id] = labelKey ? safeText(r.cells?.[labelKey]) : "";
        }

        const buildDepPoints = (
          fromBar: PrintBar,
          toBar: PrintBar,
          fromIdx: number,
          toIdx: number,
          ln: PrintDepLine
        ) => {
          const rowH = rowHeightPx;

          const OUT = 2;
          const APPROACH = 10;

          const fromIsStart = ln.type === "SS" || ln.type === "SF";
          const toIsEnd = ln.type === "FF" || ln.type === "SF";

          const fromAttachX = fromIsStart ? fromBar.x : fromBar.x + fromBar.w;
          const toAttachX = toIsEnd ? toBar.x + toBar.w : toBar.x;

          const fromY = headerRowHeight + fromIdx * rowH + rowH / 2;
          const toY = headerRowHeight + toIdx * rowH + rowH / 2;

          const sign = fromY <= toY ? -1 : 1;
          const barHalf = Math.max(1, toBar.h / 2);

          const fromX = fromIsStart ? fromAttachX - DEP_END_PAD : fromAttachX + DEP_END_PAD;
          const toX = toIsEnd ? toAttachX + DEP_END_PAD : toAttachX - DEP_END_PAD;

          const xStart = fromIsStart ? fromX - OUT : fromX + OUT;
          const xEnd = toX;

          const yEdge = toY + sign * barHalf;
          const yApproach = yEdge + sign * APPROACH;

          const ganttLeftEdge = showTable ? pageTableW + LEFT_GUTTER_PX : LEFT_GUTTER_PX;
          const ganttRightEdge = (showTable ? pageTableW : 0) + pageGanttW - RIGHT_GUTTER_PX;

          const clampX = (x: number) => Math.max(ganttLeftEdge, Math.min(ganttRightEdge, x));

          const fromXC = clampX(fromX);
          const xStartC = clampX(xStart);
          const xEndC = clampX(xEnd);

          const targetDx = xEndC - xStartC;
          const goesPositiveToTarget = targetDx >= 0;

          const points = goesPositiveToTarget
            ? [
                { x: fromXC, y: fromY },
                { x: xStartC, y: fromY },
                { x: xEndC, y: fromY },
                { x: xEndC, y: yEdge },
              ]
            : [
                { x: fromXC, y: fromY },
                { x: xStartC, y: fromY },
                { x: xStartC, y: yApproach },
                { x: xEndC, y: yApproach },
                { x: xEndC, y: yEdge },
              ];

          return points.map((p) => ({ x: snap(p.x), y: snap(p.y) }));
        };

        const pageDeps: PrintDepLine[] =
          model.options.includeDependencies && showGantt
            ? (() => {
                const barByRow = new Map<string, PrintBar>();
                for (const b of pageBars) barByRow.set(b.rowId, b);

                const out: PrintDepLine[] = [];
                for (const ln of pageDepsRaw) {
                  const fromIdx = rowIndexById.get(ln.fromRowId);
                  const toIdx = rowIndexById.get(ln.toRowId);
                  if (fromIdx === undefined || toIdx === undefined) continue;

                  const fromBar = barByRow.get(ln.fromRowId);
                  const toBar = barByRow.get(ln.toRowId);
                  if (!fromBar || !toBar) continue;

                  out.push({
                    ...ln,
                    points: buildDepPoints(fromBar, toBar, fromIdx, toIdx, ln),
                  });
                }
                return out;
              })()
            : [];

        const wm = Boolean(showWatermark && (watermarkSvgSrc || watermarkText));

        return (
          <div
            key={pageIndex}
            style={{
              width: pagePx.w,
              height: pagePx.h,
              position: "relative",
              boxSizing: "border-box",
              background: "white",
              breakAfter: pageIndex === pages.length - 1 ? "auto" : "page",
              pageBreakAfter: pageIndex === pages.length - 1 ? "auto" : "always",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: contentPx.x,
                top: contentPx.y,
                width: contentPx.w,
                height: headerHeight,
                borderBottom: `1px solid ${GRID_LINE}`,
                boxSizing: "border-box",
                display: "grid",
                gridTemplateColumns: "1fr 2fr auto",
                alignItems: "center",
                padding: "8px 12px",
                gap: 10,
              }}
            >
              <div style={{ justifySelf: "start", minWidth: 260 }}>
                {(headerLeftLines ?? []).slice(0, 3).map((l, i) => (
                  <div key={i} style={{ fontSize: 10.5, lineHeight: 1.25 }}>
                    {l}
                  </div>
                ))}
              </div>

              <div style={{ justifySelf: "center", textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    lineHeight: 1.1,
                    position: "relative",
                    top: 1,
                  }}
                >
                  {centerTitle}
                </div>
              </div>

              <div style={{ justifySelf: "end", display: "flex", alignItems: "center" }}>
                <div
                  style={{
                    width: 160,
                    height: 48,
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  {logoSrc ? (
                    <img
                      src={logoSrc}
                      alt="logo"
                      style={{
                        maxWidth: 160,
                        maxHeight: 48,
                        objectFit: "contain",
                        display: "block",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 160,
                        height: 48,
                        border: `1px dashed ${GRID_LINE}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "rgba(0,0,0,0.45)",
                      }}
                    >
                      Logo
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div
              style={{
                position: "absolute",
                left: contentPx.x,
                top: contentTop,
                width: contentPx.w,
                height: contentHeight,
                border: `1px solid ${GRID_LINE}`,
                boxSizing: "border-box",
                overflow: "hidden",
              }}
            >
              {wm ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    pointerEvents: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {watermarkSvgSrc ? (
                    <img
                      src={watermarkSvgSrc}
                      alt=""
                      style={{
                        transform: "rotate(-24deg)",
                        width: "78%",
                        maxWidth: 980,
                        opacity: 0.1,
                        objectFit: "contain",
                        userSelect: "none",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        transform: "rotate(-24deg)",
                        fontSize: 64,
                        fontWeight: 800,
                        color: "rgba(0,0,0,0.06)",
                        letterSpacing: 2,
                        textTransform: "uppercase",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                      }}
                    >
                      {watermarkText}
                    </div>
                  )}
                </div>
              ) : null}

              {showTable ? (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: pageTableW,
                    height: contentHeight,
                    boxSizing: "border-box",
                  }}
                >
                  <PrintTable
                    columns={visibleColumns}
                    rows={pageRows as any}
                    colWidths={showGantt ? auto.widths : computeAutoColumnWidths(
                      visibleColumns,
                      model.rows,
                      { maxTableW: contentPx.w }
                    ).widths}
                    rowHeightPx={rowHeightPx}
                    headerRowHeightPx={headerRowHeight}
                  />
                </div>
              ) : null}

              {showGantt ? (
                <>
                  <div
                    style={{
                      position: "absolute",
                      left: pageTableW,
                      top: 0,
                      width: pageGanttW,
                      height: headerRowHeight,
                      boxSizing: "border-box",
                      borderLeft: showTable ? `1px solid ${GRID_LINE}` : "none",
                      borderBottom: `1px solid ${GRID_LINE}`,
                      background: "rgba(0,0,0,0.02)",
                    }}
                  >
                    <GanttAxisMulti
                      model={model}
                      ganttW={pageGanttW}
                      height={headerRowHeight}
                      pxPerDay={pxPerDayScaled}
                      leftGutter={LEFT_GUTTER_PX}
                      rightGutter={RIGHT_GUTTER_PX}
                      localeKey={localeKey}
                    />
                  </div>

                  <svg
                    width={contentPx.w}
                    height={contentHeight}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      display: "block",
                      pointerEvents: "none",
                    }}
                  >
                    {showTable ? (
                      <line
                        x1={pageTableW}
                        y1={0}
                        x2={pageTableW}
                        y2={contentHeight}
                        stroke={GRID_LINE}
                        strokeWidth={1}
                      />
                    ) : null}

                    <line
                      x1={showTable ? 0 : pageTableW}
                      y1={snap(headerRowHeight)}
                      x2={showTable ? contentPx.w : pageTableW + pageGanttW}
                      y2={snap(headerRowHeight)}
                      stroke={GRID_LINE}
                      strokeWidth={1}
                    />

                    {pageRows.map((r: any, i: number) => {
                      const y = snap(headerRowHeight + i * rowHeightPx);
                      return (
                        <line
                          key={r.id}
                          x1={showTable ? 0 : pageTableW}
                          y1={y}
                          x2={showTable ? contentPx.w : pageTableW + pageGanttW}
                          y2={y}
                          stroke={GRID_LINE_LIGHT}
                          strokeWidth={1}
                        />
                      );
                    })}

                    <line
                      x1={showTable ? 0 : pageTableW}
                      y1={snap(headerRowHeight + pageRows.length * rowHeightPx)}
                      x2={showTable ? contentPx.w : pageTableW + pageGanttW}
                      y2={snap(headerRowHeight + pageRows.length * rowHeightPx)}
                      stroke={GRID_LINE_LIGHT}
                      strokeWidth={1}
                    />

                    {model.options.includeDependencies ? <SvgDepLines lines={pageDeps} /> : null}

                    <SvgBars
                      bars={pageBars}
                      showLabels={Boolean(showBarLabels)}
                      labelByRowId={labelByRowId}
                      rightLimit={(showTable ? pageTableW : 0) + pageGanttW - RIGHT_GUTTER_PX - 4}
                    />

                    {model.options.includeDependencies ? <SvgDepArrowHeads lines={pageDeps} /> : null}
                  </svg>
                </>
              ) : null}
            </div>

            <div
              style={{
                position: "absolute",
                left: contentPx.x,
                bottom: contentPx.y,
                width: contentPx.w,
                height: 28,
                borderTop: `1px solid ${GRID_LINE}`,
                boxSizing: "border-box",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 10px",
                fontSize: 10,
                color: "rgba(0,0,0,0.65)",
              }}
            >
              <div>
                Generated with <strong>Manage Progress</strong> – www.morningcoffeelabs.no
              </div>
              <div>
                Page {pageIndex + 1} / {pages.length}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
