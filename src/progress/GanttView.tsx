// src/progress/GanttView.tsx
import React, { useEffect, useId, useMemo, useRef } from "react";
import type { ColumnDef, RowData } from "../core/TableTypes";
import { useI18n } from "../i18n";
import type { DepLink } from "./ProgressCore";
import "../styles/gantt.css";

type Props = {
  columns: ColumnDef[];
  rows: RowData[];
  headerInfoText?: string;
  dateFormat?: "dd.mm.yyyy" | "yyyy-mm-dd";
  workWeekdays?: Set<number>;

  visibleRowIds?: string[];

  pxPerDay?: number;
  showWeekendShade?: boolean;
  showTodayLine?: boolean;

  ownerColors?: Record<string, string>;

  showBarText?: boolean;
  defaultBarColor?: string;

  dependencyLinks?: DepLink[];

  rangeBeforeMonths?: number;
  rangeAfterMonths?: number;
  padDaysBefore?: number;
  padDaysAfter?: number;

  onZoomDelta?: (deltaSteps: number, anchorClientX: number) => void;
};

function parseDateLoose(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t) return null;

  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(+d) ? null : d;
  }

  const m = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(+d) ? null : d;
  }

  return null;
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}
function diffDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function fmtDayNum(d: Date) {
  return pad2(d.getDate());
}
function fmtMonthOnly(d: Date, monthsShort: string[]) {
  return `${monthsShort[d.getMonth()]}`;
}
function fmtYearMonth(d: Date, monthsShort: string[]) {
  return `${d.getFullYear()} ${monthsShort[d.getMonth()]}`;
}

function isoWeekNumber(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((+d - +yearStart) / 86400000 + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

function startOfISOWeek(d: Date) {
  const x = startOfDay(d);
  const day = x.getDay();
  const iso = day === 0 ? 7 : day;
  return addDays(x, -(iso - 1));
}

type Segment = { left: number; width: number; label: string };
type GridLine = { left: number; kind?: "month" | "year" };

function buildMonthSegments(
  min: Date,
  totalDays: number,
  pxPerDay: number,
  monthsShort: string[],
  labelMode: "monthOnly" | "yearMonth"
): Segment[] {
  const out: Segment[] = [];
  const max = addDays(min, totalDays - 1);

  let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor > min) cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);

  while (cursor <= max) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);

    const segStart = cursor < min ? min : cursor;
    const segEndExcl = next > addDays(max, 1) ? addDays(max, 1) : next;

    const leftDays = diffDays(min, segStart);
    const widthDays = diffDays(segStart, segEndExcl);

    if (widthDays > 0) {
      out.push({
        left: leftDays * pxPerDay,
        width: widthDays * pxPerDay,
        label: labelMode === "yearMonth" ? fmtYearMonth(cursor, monthsShort) : fmtMonthOnly(cursor, monthsShort),
      });
    }
    cursor = next;
  }

  return out;
}

function buildYearSegments(min: Date, totalDays: number, pxPerDay: number): Segment[] {
  const out: Segment[] = [];
  const max = addDays(min, totalDays - 1);

  let cursor = new Date(min.getFullYear(), 0, 1);
  while (cursor > min) cursor = new Date(cursor.getFullYear() - 1, 0, 1);

  while (cursor <= max) {
    const next = new Date(cursor.getFullYear() + 1, 0, 1);

    const segStart = cursor < min ? min : cursor;
    const segEndExcl = next > addDays(max, 1) ? addDays(max, 1) : next;

    const leftDays = diffDays(min, segStart);
    const widthDays = diffDays(segStart, segEndExcl);

    if (widthDays > 0) {
      out.push({
        left: leftDays * pxPerDay,
        width: widthDays * pxPerDay,
        label: String(cursor.getFullYear()),
      });
    }

    cursor = next;
  }

  return out;
}

function buildWeekSegments(min: Date, totalDays: number, pxPerDay: number, weekPrefix: string): Segment[] {
  const out: Segment[] = [];
  const max = addDays(min, totalDays - 1);
  const endExcl = addDays(max, 1);

  let cursor = startOfISOWeek(min);

  while (cursor < endExcl) {
    const next = addDays(cursor, 7);

    const segStart = cursor < min ? min : cursor;
    const segEndExcl = next > endExcl ? endExcl : next;

    const leftDays = diffDays(min, segStart);
    const widthDays = diffDays(segStart, segEndExcl);

    if (widthDays > 0) {
      const wk = isoWeekNumber(cursor);
      out.push({
        left: leftDays * pxPerDay,
        width: widthDays * pxPerDay,
        label: `${weekPrefix} ${wk.week}`,
      });
    }

    cursor = next;
  }

  return out;
}

type Block = { left: number; width: number };

function buildWeekendBlocks(
  min: Date,
  totalDays: number,
  pxPerDay: number,
  workWeekdays?: Set<number>
): Block[] {
  const blocks: Block[] = [];
  let i = 0;

  const ww = workWeekdays;

  while (i < totalDays) {
    const d = addDays(min, i);
    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;

    const isClosedWeekend = isWeekend && (ww ? !ww.has(day) : true);

    if (!isClosedWeekend) {
      i++;
      continue;
    }

    const start = i;
    let end = i + 1;
    while (end < totalDays) {
      const dd = addDays(min, end);
      const dw = dd.getDay();
      const isW = dw === 0 || dw === 6;
      const closed = isW && (ww ? !ww.has(dw) : true);
      if (!closed) break;
      end++;
    }

    blocks.push({
      left: start * pxPerDay,
      width: (end - start) * pxPerDay,
    });

    i = end;
  }

  return blocks;
}

function buildMonthGridLines(min: Date, totalDays: number, pxPerDay: number): GridLine[] {
  const out: GridLine[] = [];
  const max = addDays(min, totalDays - 1);
  const endExcl = addDays(max, 1);

  let cursor = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cursor > min) cursor = new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1);

  while (cursor < endExcl) {
    const leftDays = diffDays(min, cursor);
    if (leftDays >= 0 && leftDays <= totalDays) {
      out.push({
        left: leftDays * pxPerDay,
        kind: cursor.getMonth() === 0 ? "year" : "month",
      });
    }
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
  }

  out.push({ left: totalDays * pxPerDay, kind: "month" });
  return out;
}

type BarRect = { left: number; right: number; y: number };

type HeaderLayout = {
  lineCount: 1 | 2 | 3;
  top: "year" | "monthOnly" | "yearMonth";
  mid: "year" | "monthOnly" | "week" | "none";
  bot: "week" | "day" | "none";
  gridMode: "day" | "week" | "month";
  monthLabelModeForTop?: "monthOnly" | "yearMonth";
  monthLabelModeForMid?: "monthOnly" | "yearMonth";
};

function pickHeaderLayout(pxPerDay: number): HeaderLayout {
  if (pxPerDay >= 24) {
    return {
      lineCount: 3,
      top: "yearMonth",
      mid: "week",
      bot: "day",
      gridMode: "day",
      monthLabelModeForTop: "yearMonth",
      monthLabelModeForMid: "monthOnly",
    };
  }

  if (pxPerDay >= 10) {
    return {
      lineCount: 3,
      top: "year",
      mid: "monthOnly",
      bot: "week",
      gridMode: "week",
      monthLabelModeForTop: "yearMonth",
      monthLabelModeForMid: "monthOnly",
    };
  }

  if (pxPerDay >= 3) {
    return {
      lineCount: 2,
      top: "year",
      mid: "monthOnly",
      bot: "none",
      gridMode: "month",
      monthLabelModeForTop: "yearMonth",
      monthLabelModeForMid: "monthOnly",
    };
  }

  return {
    lineCount: 1,
    top: "year",
    mid: "none",
    bot: "none",
    gridMode: "month",
  };
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function hexToRgb(hexRaw: string): { r: number; g: number; b: number } | null {
  const hex = String(hexRaw || "").trim().replace("#", "");
  if (hex.length === 3) {
    const r = parseInt(hex[0] + hex[0], 16);
    const g = parseInt(hex[1] + hex[1], 16);
    const b = parseInt(hex[2] + hex[2], 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    if ([r, g, b].some((n) => Number.isNaN(n))) return null;
    return { r, g, b };
  }
  return null;
}

function readableTextColor(bgHex: string): string {
  const rgb = hexToRgb(bgHex);
  if (!rgb) return "white";
  const srgb = [rgb.r, rgb.g, rgb.b].map((v) => v / 255);
  const lin = srgb.map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.6 ? "#111" : "white";
}

// (legacy helper – OK to keep)
function getContrastTextColor(hex: string | undefined | null): string {
  if (!hex) return "rgba(0,0,0,0.78)";
  const h = hex.replace("#", "").trim();
  if (h.length !== 6) return "rgba(0,0,0,0.78)";

  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);

  if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b)) return "rgba(0,0,0,0.78)";

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.92)";
}

export default function GanttView({
  columns,
  rows,
  dateFormat = "dd.mm.yyyy",
  visibleRowIds,
  workWeekdays,

  pxPerDay: pxPerDayProp,
  showWeekendShade = true,
  showTodayLine = true,

  ownerColors,

  showBarText: showBarTextProp,
  defaultBarColor,

  dependencyLinks,

  rangeBeforeMonths = 6,
  rangeAfterMonths = 24,
  padDaysBefore = 0,
  padDaysAfter = 0,

  onZoomDelta,
}: Props) {
  const { t } = useI18n();

  const rootRef = useRef<HTMLDivElement | null>(null);
  const hScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const zoomEl = rootRef.current;
    const hEl = hScrollRef.current;

    if (!zoomEl && !hEl) return;

    const onWheel = (e: WheelEvent) => {
      if (e.altKey) {
        if (!onZoomDelta) return;
        e.preventDefault();
        const step = e.deltaY < 0 ? +1 : -1;
        onZoomDelta(step, e.clientX);
        return;
      }

      const el = hEl;
      if (!el) return;

      const canScrollX = el.scrollWidth > el.clientWidth + 1;
      if (!canScrollX) return;

      const canScrollY = el.scrollHeight > el.clientHeight + 1;
      if (canScrollY) return;

      const hasDeltaX = Math.abs(e.deltaX) > 0.1;
      if (hasDeltaX) return;

      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    if (zoomEl) zoomEl.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      if (zoomEl) zoomEl.removeEventListener("wheel", onWheel as any);
    };
  }, [onZoomDelta]);

  const startKey = useMemo(() => columns.find((c) => c.dateRole === "start")?.key ?? "start", [columns]);
  const endKey = useMemo(() => columns.find((c) => c.dateRole === "end")?.key ?? "end", [columns]);
  const titleKey = useMemo(() => columns.find((c) => c.isTitle)?.key ?? "title", [columns]);
  const ownerKey = useMemo(() => columns.find((c) => c.key === "owner")?.key ?? "owner", [columns]);

  const viewRows = useMemo(() => {
    if (!visibleRowIds) return rows;

    const map = new Map<string, RowData>();
    for (const r of rows) map.set(r.id, r);

    const out: RowData[] = [];
    for (const id of visibleRowIds) {
      const r = map.get(id);
      if (r) out.push(r);
    }
    return out;
  }, [rows, visibleRowIds]);

  const monthsShort = useMemo(
    () => [
      t("gantt.monthShort.jan"),
      t("gantt.monthShort.feb"),
      t("gantt.monthShort.mar"),
      t("gantt.monthShort.apr"),
      t("gantt.monthShort.may"),
      t("gantt.monthShort.jun"),
      t("gantt.monthShort.jul"),
      t("gantt.monthShort.aug"),
      t("gantt.monthShort.sep"),
      t("gantt.monthShort.oct"),
      t("gantt.monthShort.nov"),
      t("gantt.monthShort.dec"),
    ],
    [t]
  );

  const weekPrefixBase = t("gantt.weekPrefix");
  const isEnglishWeek = weekPrefixBase.trim().toLowerCase() === "week";
  const isTightWeek = pxPerDayProp === 10 || pxPerDayProp === 12 || pxPerDayProp === 14;
  const weekPrefix = isTightWeek && isEnglishWeek ? "wk" : weekPrefixBase;

  const pxPerDay = clamp(Math.round(pxPerDayProp ?? 24), 3, 80);

  const parsed = useMemo(() => {
    const items = viewRows.map((r) => {
      const s = String((r as any).cells?.[startKey] ?? "");
      const e = String((r as any).cells?.[endKey] ?? "");
      const sd = parseDateLoose(s);
      const ed = parseDateLoose(e);
      return { row: r, sd, ed };
    });

    const dates = items.flatMap((it) => [it.sd, it.ed]).filter(Boolean) as Date[];

    let minData = dates.length ? startOfDay(dates[0]) : startOfDay(new Date());
    let maxData = dates.length ? startOfDay(dates[0]) : startOfDay(new Date());

    for (const d of dates) {
      const dd = startOfDay(d);
      if (dd < minData) minData = dd;
      if (dd > maxData) maxData = dd;
    }

    const min = startOfDay(addDays(addMonths(minData, -rangeBeforeMonths), -padDaysBefore));
    const max = startOfDay(addDays(addMonths(maxData, rangeAfterMonths), padDaysAfter));

    const totalDays = Math.max(1, diffDays(min, max) + 1);
    return { items, min, max, totalDays };
  }, [viewRows, startKey, endKey, dateFormat, rangeBeforeMonths, rangeAfterMonths, padDaysBefore, padDaysAfter]);

  const layout = useMemo(() => pickHeaderLayout(pxPerDay), [pxPerDay]);
  const timelineWidth = parsed.totalDays * pxPerDay;

  const monthSegsYearMonth = useMemo(
    () => buildMonthSegments(parsed.min, parsed.totalDays, pxPerDay, monthsShort, "yearMonth"),
    [parsed.min, parsed.totalDays, pxPerDay, monthsShort]
  );
  const monthSegsMonthOnly = useMemo(
    () => buildMonthSegments(parsed.min, parsed.totalDays, pxPerDay, monthsShort, "monthOnly"),
    [parsed.min, parsed.totalDays, pxPerDay, monthsShort]
  );

  const weekSegs = useMemo(() => buildWeekSegments(parsed.min, parsed.totalDays, pxPerDay, weekPrefix), [
    parsed.min,
    parsed.totalDays,
    pxPerDay,
    weekPrefix,
  ]);

  const yearSegs = useMemo(() => buildYearSegments(parsed.min, parsed.totalDays, pxPerDay), [
    parsed.min,
    parsed.totalDays,
    pxPerDay,
  ]);

  const weekendBlocks = useMemo(
    () => buildWeekendBlocks(parsed.min, parsed.totalDays, pxPerDay, workWeekdays),
    [parsed.min, parsed.totalDays, pxPerDay, workWeekdays]
  );

  const todayLeft = useMemo(() => {
    const tday = startOfDay(new Date());
    const leftDays = diffDays(parsed.min, tday);
    if (leftDays < 0 || leftDays > parsed.totalDays) return null;
    return leftDays * pxPerDay;
  }, [parsed.min, parsed.totalDays, pxPerDay]);

  const monthGridLines = useMemo(() => {
    if (layout.gridMode !== "month") return [];
    return buildMonthGridLines(parsed.min, parsed.totalDays, pxPerDay);
  }, [layout.gridMode, parsed.min, parsed.totalDays, pxPerDay]);

  const pxVars = useMemo(
    () =>
      ({
        ["--gv-px-per-day" as any]: `${pxPerDay}px`,
        ["--gv-band-count" as any]: String(layout.lineCount),
        ["--gv-grid-size" as any]: layout.gridMode === "week" ? `${pxPerDay * 7}px` : `${pxPerDay}px`,
      } as React.CSSProperties),
    [pxPerDay, layout.lineCount, layout.gridMode]
  );

  // Dependencies render (includes milestones)
  const depRender = useMemo(() => {
    const rowH = 28; // MUST match --tc-row-h
    const barTop = 6;
    const barH = rowH - 12;

    const rectByRowId = new Map<string, BarRect>();

    parsed.items.forEach((it, idx) => {
      const title = String((it.row as any).cells?.[titleKey] ?? "");
      const sd = it.sd ? startOfDay(it.sd) : null;
      const ed = it.ed ? startOfDay(it.ed) : null;
      const isMilestone = !!(it.row as any).milestone;
      
      if (!sd || !title) return;

      const y = idx * rowH + barTop + barH / 2;
      
      if (isMilestone) {
        const x = diffDays(parsed.min, sd) * pxPerDay + pxPerDay / 2;
        const half = 6;
        rectByRowId.set(it.row.id, { left: x - half, right: x + half, y });
        return;
      }
      
      if (!ed) return;
      
      const left = diffDays(parsed.min, sd) * pxPerDay;
      const width = Math.max(pxPerDay, (diffDays(sd, ed) + 1) * pxPerDay);
      rectByRowId.set(it.row.id, { left, right: left + width, y });
      });
    
    const links = (dependencyLinks ?? [])
      .filter((ln) => rectByRowId.has(ln.fromRowId) && rectByRowId.has(ln.toRowId))
      .map((ln) => {
        const a = rectByRowId.get(ln.fromRowId)!;
        const b = rectByRowId.get(ln.toRowId)!;
        return { ...ln, a, b };
      });

    const svgH = parsed.items.length * rowH;

    return { links, svgH, barH };
  }, [dependencyLinks, parsed.items, parsed.min, pxPerDay, titleKey]);

  const reactId = useId();
  const arrowId = `gvArrow-${reactId.replace(/[:]/g, "")}`;

  const rootClass =
    `gv-root gv-grid-${layout.gridMode} ` +
    (layout.lineCount === 3 ? "gv-lines-3" : layout.lineCount === 2 ? "gv-lines-2" : "gv-lines-1");

  const weekdayShort = useMemo(
    () => [
      t("gantt.weekdayShort.mon"),
      t("gantt.weekdayShort.tue"),
      t("gantt.weekdayShort.wed"),
      t("gantt.weekdayShort.thu"),
      t("gantt.weekdayShort.fri"),
      t("gantt.weekdayShort.sat"),
      t("gantt.weekdayShort.sun"),
    ],
    [t]
  );

  const renderTopBand = () => {
    if (layout.top === "year") {
      return yearSegs.map((s, i) => (
        <div key={`y-top-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
          {s.label}
        </div>
      ));
    }

    if (layout.top === "yearMonth") {
      return monthSegsYearMonth.map((s, i) => (
        <div key={`ym-top-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
          {s.label}
        </div>
      ));
    }

    return monthSegsMonthOnly.map((s, i) => (
      <div key={`m-top-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
        {s.label}
      </div>
    ));
  };

  const renderMidBand = () => {
    if (layout.mid === "none") return null;

    if (layout.mid === "year") {
      return yearSegs.map((s, i) => (
        <div key={`y-mid-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
          {s.label}
        </div>
      ));
    }

    if (layout.mid === "monthOnly") {
      return monthSegsMonthOnly.map((s, i) => (
        <div key={`m-mid-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
          {s.label}
        </div>
      ));
    }

    return weekSegs.map((s, i) => (
      <div key={`w-mid-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
        {s.label}
      </div>
    ));
  };

  const renderBotBand = () => {
    if (layout.bot === "none") return null;

    if (layout.bot === "week") {
      return weekSegs.map((s, i) => (
        <div key={`w-bot-${i}-${s.label}`} className="gv-seg" style={{ left: s.left, width: s.width }} title={s.label}>
          {s.label}
        </div>
      ));
    }

    return Array.from({ length: parsed.totalDays }).map((_, i) => {
      const d = addDays(parsed.min, i);
      const dd = fmtDayNum(d);
      const showWeekday = pxPerDay >= 32;

      const wdIdx = (d.getDay() + 6) % 7;
      const wd = showWeekday ? weekdayShort[wdIdx] : "";

      return (
        <div key={`d-${i}`} className="gv-day" style={{ width: pxPerDay }} title={`${wd} ${dd}`.trim()}>
          {wd ? `${wd} ${dd}` : dd}
        </div>
      );
    });
  };

  return (
    <div ref={rootRef} className={rootClass} style={pxVars}>
      <div ref={hScrollRef} className="gv-content">
        <div className="gv-header-stack">
          <div className="gv-timeline3" style={{ width: timelineWidth }}>
            {showWeekendShade ? (
              <div className="gv-weekend-layer" aria-hidden="true">
                {weekendBlocks.map((b, i) => (
                  <div key={`wh-${i}`} className="gv-weekend" style={{ left: b.left, width: b.width }} />
                ))}
              </div>
            ) : null}

            {showTodayLine && todayLeft !== null ? (
              <div className="gv-today-line" aria-hidden="true" style={{ left: todayLeft }} />
            ) : null}

            <div className="gv-band gv-band--month">{renderTopBand()}</div>
            <div className="gv-band gv-band--week">{renderMidBand()}</div>
            <div className="gv-band gv-band--day">{renderBotBand()}</div>
          </div>
        </div>

        <div className="gv-rows-clip">
          <div className="gv-rows" style={{ width: timelineWidth }}>
            {showWeekendShade ? (
              <div className="gv-weekend-layer" aria-hidden="true">
                {weekendBlocks.map((b, i) => (
                  <div key={`wb-${i}`} className="gv-weekend" style={{ left: b.left, width: b.width }} />
                ))}
              </div>
            ) : null}

            {showTodayLine && todayLeft !== null ? (
              <div className="gv-today-line" aria-hidden="true" style={{ left: todayLeft }} />
            ) : null}

            {layout.gridMode === "month" ? (
              <div className="gv-mgrid" aria-hidden="true">
                {monthGridLines.map((ln, i) => (
                  <div
                    key={`mg-${i}`}
                    className={`gv-mgrid-line ${ln.kind === "year" ? "is-year" : ""}`}
                    style={{ left: ln.left }}
                  />
                ))}
              </div>
            ) : null}

            <div className="gv-vlines" aria-hidden="true">
              {Array.from({ length: parsed.totalDays + 1 }).map((_, i) => (
                <div key={`vl-${i}`} className="gv-vline" style={{ left: i * pxPerDay }} />
              ))}
            </div>

            {depRender.links.length ? (
              <svg
                className="gv-links"
                aria-hidden="true"
                width={timelineWidth}
                height={depRender.svgH}
                viewBox={`0 0 ${timelineWidth} ${depRender.svgH}`}
                preserveAspectRatio="none"
                shapeRendering="geometricPrecision"
              >
                <defs>
                  <marker
                    id={arrowId}
                    viewBox="0 0 10 10"
                    refX="10"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    markerUnits="userSpaceOnUse"
                    orient="auto"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                  </marker>
                </defs>

                {depRender.links.map((ln: any, i) => {
                  const a = ln.a as BarRect;
                  const b = ln.b as BarRect;

                  const y1 = a.y;
                  const y2 = b.y;

                  const type = String(ln.type ?? "FS").toUpperCase();
                  const fromIsStart = type === "SS" || type === "SF";
                  const toIsEnd = type === "FF" || type === "SF";

                  const OUT = 2;
const fromEdgeX = fromIsStart ? a.left : a.right;
const xStart = fromIsStart ? fromEdgeX - OUT : fromEdgeX + OUT;

const IN = 0;
const xEnd = toIsEnd ? b.right - IN : b.left + IN;

const sign = y1 <= y2 ? -1 : 1;
const barHalf = (depRender.barH ?? 16) / 2;

const yEdge = y2 + sign * barHalf;
const yApproach = yEdge + sign * 10;

const clampX = (x: number) => Math.max(0, Math.min(timelineWidth, x));

const xStartC = clampX(xStart);
const xEndC = clampX(xEnd);
const fromEdgeXC = clampX(fromEdgeX);

const targetDx = xEndC - xStartC;
const goesPositiveToTarget = targetDx >= 0;

const pts = goesPositiveToTarget
  ? [
      { x: fromEdgeXC, y: y1 },
      { x: xStartC, y: y1 },
      { x: xEndC, y: y1 },
      { x: xEndC, y: yEdge },
    ]
  : [
      { x: fromEdgeXC, y: y1 },
      { x: xStartC, y: y1 },
      { x: xStartC, y: yApproach },
      { x: xEndC, y: yApproach },
      { x: xEndC, y: yEdge },
    ];

                  const r = 2;

                  function roundedPath(points: { x: number; y: number }[], radius: number) {
                    if (points.length < 2) return "";
                    let d = `M ${points[0].x} ${points[0].y}`;

                    for (let j = 1; j < points.length; j++) {
                      const p0 = points[j - 1];
                      const p1 = points[j];
                      const p2 = points[j + 1];

                      if (!p2) {
                        d += ` L ${p1.x} ${p1.y}`;
                        continue;
                      }

                      const dx1 = p1.x - p0.x;
                      const dy1 = p1.y - p0.y;
                      const dx2 = p2.x - p1.x;
                      const dy2 = p2.y - p1.y;

                      const len1 = Math.max(0.0001, Math.abs(dx1) + Math.abs(dy1));
                      const len2 = Math.max(0.0001, Math.abs(dx2) + Math.abs(dy2));

                      const rr = Math.min(radius, len1 / 2, len2 / 2);

                      const xA = p1.x - (dx1 !== 0 ? Math.sign(dx1) * rr : 0);
                      const yA = p1.y - (dy1 !== 0 ? Math.sign(dy1) * rr : 0);

                      const xB = p1.x + (dx2 !== 0 ? Math.sign(dx2) * rr : 0);
                      const yB = p1.y + (dy2 !== 0 ? Math.sign(dy2) * rr : 0);

                      d += ` L ${xA} ${yA}`;
                      d += ` Q ${p1.x} ${p1.y} ${xB} ${yB}`;
                    }

                    return d;
                  }

                  const pathD = roundedPath(pts, r);
                  const cls = ln.valid ? "gv-link" : "gv-link gv-link--bad";

                  return <path key={i} d={pathD} className={cls} markerEnd={`url(#${arrowId})`} />;
                })}
              </svg>
            ) : null}

            {parsed.items.map((it, idx) => {
              const title = String((it.row as any).cells?.[titleKey] ?? "");
              const sd = it.sd ? startOfDay(it.sd) : null;
              const ed = it.ed ? startOfDay(it.ed) : null;
              const isMilestone = !!(it.row as any).milestone;
              
              if (!sd || !title) {
                return (
                  <div key={it.row.id} className="gv-row">
                    <div className={`gv-row-grid ${layout.gridMode === "month" ? "is-off" : ""}`} />
                  </div>
                );
              }

              const owner = String((it.row as any).cells?.[ownerKey] ?? "").trim();

              const barColor =
                (owner ? ownerColors?.[owner] : "") ||
                defaultBarColor ||
                "#b98a3a";

              const textColor = readableTextColor(barColor);

              const milestoneLeft = diffDays(parsed.min, sd) * pxPerDay + pxPerDay / 2;
              const hasBarRange = !!ed && diffDays(sd, ed) >= 0;
              
              if (isMilestone && !hasBarRange) {
                const msStyle: React.CSSProperties = {
                  left: milestoneLeft,
                  backgroundColor: barColor,
                  color: textColor,
                };
              
                return (
                  <div key={it.row.id} className="gv-row">
                    <div className={`gv-row-grid ${layout.gridMode === "month" ? "is-off" : ""}`} />
                    <div
                      className="gv-ms"
                      style={msStyle}
                      title={`${title}: ${String((it.row as any).cells?.[startKey] ?? "")}`}
                    />
                  </div>
                );
              }
              
              if (!ed) {
                return (
                  <div key={it.row.id} className="gv-row">
                    <div className={`gv-row-grid ${layout.gridMode === "month" ? "is-off" : ""}`} />
                    {isMilestone ? (
                      <div
                        className="gv-ms"
                        style={{
                          left: milestoneLeft,
                          backgroundColor: barColor,
                          color: textColor,
                        }}
                        title={`${title}: ${String((it.row as any).cells?.[startKey] ?? "")}`}
                      />
                    ) : null}
                  </div>
                );
              }
              
              const totalDaysSpan = diffDays(sd, ed) + 1;

              const left = isMilestone
                ? diffDays(parsed.min, sd) * pxPerDay + pxPerDay
                : diffDays(parsed.min, sd) * pxPerDay;
              
              let width = isMilestone
                ? Math.max(0, (totalDaysSpan - 1) * pxPerDay)
                : totalDaysSpan * pxPerDay;
              
              width = Math.max(0, width);

              const showBar = width > 0;
              const hasRoomForText = width >= pxPerDay * 3;
              const allowText = showBarTextProp !== false;

              const barStyle: React.CSSProperties = {
                left,
                width,
                backgroundColor: barColor,
                color: textColor,
              };

              return (
                <div key={it.row.id} className="gv-row">
                  <div className={`gv-row-grid ${layout.gridMode === "month" ? "is-off" : ""}`} />
              
                  {showBar ? (
                    <div
                      className="gv-bar"
                      style={barStyle}
                      title={`${title}: ${String((it.row as any).cells?.[startKey] ?? "")} → ${String(
                        (it.row as any).cells?.[endKey] ?? ""
                      )}`}
                    >
                      {allowText && hasRoomForText ? <span className="gv-bar-text">{title}</span> : null}
                    </div>
                  ) : null}
              
                  {isMilestone ? (
                    <div
                      className="gv-ms"
                      style={{
                        left: milestoneLeft,
                        backgroundColor: barColor,
                        color: textColor,
                      }}
                      title={`${title}: ${String((it.row as any).cells?.[startKey] ?? "")}`}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
