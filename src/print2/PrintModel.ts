// src/print2/PrintModel.ts
import type { ColumnDef, RowData, CellValue } from "../core/TableTypes";
import type { DepLink } from "../progress/ProgressCore";
import type {
  PrintInput,
  PrintModel,
  PrintOptions,
  PrintRow,
  PrintBar,
  PrintDepLine,
  PrintRange,
  TimeScale,
} from "./PrintTypes";

// =========================================================
// Deterministiske konstanter for papir (mm)
// =========================================================
const MM_PER_INCH = 25.4;
const DPI = 96;
const PX_PER_MM = DPI / MM_PER_INCH;

function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

function pageSizeMm(page: "A4" | "A3" | "LETTER" | "TABLOID"): { w: number; h: number } {
  // All sizes returned as LANDSCAPE (w x h) in mm.
  // ISO 216
  if (page === "A3") return { w: 420, h: 297 };
  if (page === "A4") return { w: 297, h: 210 };

  // US sizes
  // Letter: 8.5 x 11 in  => 215.9 x 279.4 mm (landscape => 279.4 x 215.9)
  if (page === "LETTER") return { w: 279.4, h: 215.9 };

  // Tabloid/Ledger: 11 x 17 in => 279.4 x 431.8 mm (landscape => 431.8 x 279.4)
  return { w: 431.8, h: 279.4 }; // TABLOID
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function atMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

function daysBetween(a: Date, b: Date): number {
  const ms = atMidnight(b).getTime() - atMidnight(a).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

// =========================================================
// Dato-parsing (DMY loose + ISO)
// =========================================================
function parseISOLoose(s: string): Date | null {
  const t = (s ?? "").trim();
  const m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const da = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || da < 1 || da > 31) return null;
  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return atMidnight(d);
}

function parseDMYLoose(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t) return null;

  // dd.mm.yyyy / d.m.yyyy / dd/mm/yyyy / d/m/yyyy / dd-mm-yyyy
  const m = t.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return parseISOLoose(t);

  const da = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || da < 1 || da > 31) return null;

  const d = new Date(y, mo - 1, da);
  if (d.getFullYear() !== y || d.getMonth() !== mo - 1 || d.getDate() !== da) return null;
  return atMidnight(d);
}

function readStartEnd(
  r: RowData,
  startKey: string,
  endKey: string
): { s: Date | null; e: Date | null } {
  const s = parseDMYLoose(String((r.cells as any)?.[startKey] ?? ""));
  const e = parseDMYLoose(String((r.cells as any)?.[endKey] ?? ""));
  return { s, e };
}

// =========================================================
// “Rad har data” kontrakt
// =========================================================
function cellHasData(v: CellValue): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "number") return !Number.isNaN(v);
  const t = String(v).trim();
  return t.length > 0;
}

function rowHasAnyData(
  r: RowData,
  columns: ColumnDef[],
  startKey: string | null,
  endKey: string | null
): boolean {
  for (const c of columns) {
    const v = (r.cells as any)?.[c.key];
    if (cellHasData(v)) return true;
  }
  if (startKey && endKey) {
    const { s, e } = readStartEnd(r, startKey, endKey);
    if (s || e) return true;
  }
  return false;
}

// =========================================================
// Hierarki: parent = tidligere rad med lavere indent
// =========================================================
function computeParentMap(rows: RowData[]): Record<string, string | null> {
  const parentById: Record<string, string | null> = {};
  const stack: Array<{ id: string; indent: number }> = [];

  for (const r of rows) {
    const indent = Math.max(0, Math.round(r.indent ?? 0));

    while (stack.length && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }
    const parent = stack.length ? stack[stack.length - 1].id : null;
    parentById[r.id] = parent;

    stack.push({ id: r.id, indent });
  }

  return parentById;
}

// =========================================================
// Skala-regel (labels)
// =========================================================
function chooseScale(totalDays: number): TimeScale {
  if (totalDays <= 35) return "day";
  if (totalDays <= 180) return "week";
  if (totalDays <= 900) return "month";
  return "year";
}

// =========================================================
// PrintModel builder
// =========================================================
const DEFAULTS: Required<PrintOptions> = {
  pageSize: "A4",
  orientation: "landscape",
  includeDependencies: true,
  marginMm: { top: 12, right: 12, bottom: 12, left: 12 },
  rowHeightPx: 28,
  barHeightPx: 12,
  barInsetYPx: 8,
  tableMaxWidthPx: 520,
  tableMinWidthPx: 360,
};

export function buildPrintModel(input: PrintInput, opts?: Partial<PrintOptions>): PrintModel {
  const options: Required<PrintOptions> = {
    ...DEFAULTS,
    ...(opts ?? {}),
    marginMm: { ...DEFAULTS.marginMm, ...(opts?.marginMm ?? {}) },
  };

  const columns = input.columns ?? [];
  const rows = input.rows ?? [];
  const deps: DepLink[] = input.dependencies ?? [];

  const startCol = columns.find((c) => c.dateRole === "start") ?? null;
  const endCol = columns.find((c) => c.dateRole === "end") ?? null;

  const hasAnyCellValue = (key: string): boolean => {
    for (const r of rows) {
      const v = (r.cells as any)?.[key];
      if (v === null || v === undefined) continue;
      if (String(v).trim()) return true;
    }
    return false;
  };

  // Primært: dateRole (hvis start/end-kolonnene er med i input.columns)
  let startKey: string | null = startCol?.key ?? null;
  let endKey: string | null = endCol?.key ?? null;

  // Fallback: hvis start/end er skjult i print-kolonner, men finnes fortsatt i row.cells
  if (!startKey) {
    const startCandidates = ["start", "Start", "START", "fra", "from"];
    startKey = startCandidates.find((k) => hasAnyCellValue(k)) ?? null;
  }
  if (!endKey) {
    const endCandidates = ["end", "End", "END", "slutt", "til", "to"];
    endKey = endCandidates.find((k) => hasAnyCellValue(k)) ?? null;
  }

  // Hvis vi bare fant én av dem, så nuller vi begge for å unngå halv-geometri
  if (!(startKey && endKey)) {
    startKey = null;
    endKey = null;
  }

  // Owner-farger (fra app). Vi mapper row.cells[ownerKey] -> input.ownerColors[ownerName]
  const ownerKey = columns.find((c) => c.key === "owner")?.key ?? "owner";

  const normalizeOwner = (s: any) => String(s ?? "").trim();
  const ownerColorMap = input.ownerColors ?? {};

  // ✅ NY: global default bar color (fallback hvis owner ikke har farge)
  const globalDefaultBarColorRaw = normalizeOwner((input as any)?.defaultBarColor);
  const globalDefaultBarColor =
    globalDefaultBarColorRaw && globalDefaultBarColorRaw.length > 0
      ? globalDefaultBarColorRaw
      : "";

  // 1) merk rader som har data
  const keepDirect = new Set<string>();
  for (const r of rows) {
    if (rowHasAnyData(r, columns, startKey, endKey)) keepDirect.add(r.id);
  }

  // 2) behold parents av “kept” rader
  const parentMap = computeParentMap(rows);
  const keepAll = new Set<string>(keepDirect);
  let keptBecauseParent = 0;

  for (const id of Array.from(keepDirect)) {
    let p = parentMap[id];
    while (p) {
      if (!keepAll.has(p)) {
        keepAll.add(p);
        keptBecauseParent++;
      }
      p = parentMap[p];
    }
  }

  // 3) filtrer i original rekkefølge
  const filteredRows: RowData[] = rows.filter((r) => keepAll.has(r.id));
  const filteredOutRowCount = rows.length - filteredRows.length;

  // 4) PrintRow
  const printRows: PrintRow[] = filteredRows.map((r, index) => {
    const cells: Record<string, string> = {};
    for (const c of columns) {
      const v = (r.cells as any)?.[c.key];
      cells[c.key] = v === null || v === undefined ? "" : String(v).trim();
    }

    let sISO: string | null = null;
    let eISO: string | null = null;

    if (startKey && endKey) {
      const { s, e } = readStartEnd(r, startKey, endKey);
      sISO = s ? toISODate(s) : null;
      eISO = e ? toISODate(e) : null;
    }

    return {
      id: r.id,
      indent: Math.max(0, Math.round(r.indent ?? 0)),
      cells,
      startISO: sISO,
      endISO: eISO,
      index,
    };
  });

  // 5) range: min/max av faktiske dater
  let minD: Date | null = null;
  let maxD: Date | null = null;

  if (startKey && endKey) {
    for (const pr of printRows) {
      const s = pr.startISO ? parseISOLoose(pr.startISO) : null;
      const e = pr.endISO ? parseISOLoose(pr.endISO) : null;

      if (s) {
        if (!minD || s.getTime() < minD.getTime()) minD = s;
      }
      if (e) {
        if (!maxD || e.getTime() > maxD.getTime()) maxD = e;
      }
    }
  }

  const today = atMidnight(new Date());
  if (!minD) minD = today;
  if (!maxD) maxD = minD;

  // padding
  const rangeStart = addDays(minD, -3);
  const rangeEnd = addDays(maxD, +3);
  const totalDays = daysBetween(rangeStart, rangeEnd) + 1;

  const range: PrintRange = {
    startISO: toISODate(rangeStart),
    endISO: toISODate(rangeEnd),
    totalDays,
  };

  // 6) page/layout px
  const mm = pageSizeMm(options.pageSize);
  const pagePx = { w: Math.round(mmToPx(mm.w)), h: Math.round(mmToPx(mm.h)) };

  const m = options.marginMm;
  const contentPx = {
    x: Math.round(mmToPx(m.left)),
    y: Math.round(mmToPx(m.top)),
    w: Math.round(pagePx.w - mmToPx(m.left + m.right)),
    h: Math.round(pagePx.h - mmToPx(m.top + m.bottom)),
  };

  // 7) venstre tabellbredde
  const sumColWidth = columns.reduce((acc, c) => acc + (c.width ?? 120), 0);
  const suggestedTable = clamp(sumColWidth, options.tableMinWidthPx, options.tableMaxWidthPx);

  const tablePx = { x: contentPx.x, y: contentPx.y, w: suggestedTable, h: contentPx.h };
  const ganttPx = {
    x: contentPx.x + suggestedTable,
    y: contentPx.y,
    w: Math.max(160, contentPx.w - suggestedTable),
    h: contentPx.h,
  };

  // 8) pxPerDay auto
  const pxPerDay = Math.max(1, ganttPx.w / Math.max(1, totalDays));
  const scale = chooseScale(totalDays);

  const layout = {
    pagePx,
    contentPx,
    tablePx,
    ganttPx,
    pxPerDay,
    scale,
    rowHeightPx: options.rowHeightPx,
    barHeightPx: options.barHeightPx,
    barInsetYPx: options.barInsetYPx,
  };

    // 9) bars + milestones
    const bars: PrintBar[] = [];
    for (const pr of printRows) {
      if (!pr.startISO) continue;
  
      const s = parseISOLoose(pr.startISO);
      const e = pr.endISO ? parseISOLoose(pr.endISO) : null;
      if (!s) continue;
  
      const ownerName = normalizeOwner(pr.cells?.[ownerKey]);
      const rawOwnerColor = ownerName ? normalizeOwner(ownerColorMap[ownerName]) : "";
  
      // ✅ Prioritet: ownerColor -> global defaultBarColor -> undefined
      const color = rawOwnerColor || globalDefaultBarColor || undefined;
  
      const y = ganttPx.y + pr.index * options.rowHeightPx + options.barInsetYPx;
      const h = options.barHeightPx;
  
      // Milestone: start finnes, end mangler
      if (!e) {
        const startOffsetDays = daysBetween(rangeStart, s);
        const centerX = ganttPx.x + startOffsetDays * pxPerDay + pxPerDay / 2;
  
        bars.push({
          rowId: pr.id,
          x: centerX - h / 2,
          y,
          w: h,
          h,
          startISO: pr.startISO,
          endISO: null,
          isMilestone: true,
          color,
        });
        continue;
      }
  
      const startOffsetDays = daysBetween(rangeStart, s);
      const endOffsetDays = daysBetween(rangeStart, e);
      const x = ganttPx.x + startOffsetDays * pxPerDay;
      const w = Math.max(1, (endOffsetDays - startOffsetDays + 1) * pxPerDay);
  
      bars.push({
        rowId: pr.id,
        x,
        y,
        w,
        h,
        startISO: pr.startISO,
        endISO: pr.endISO,
        isMilestone: false,
        color,
      });
    }

  // 10) dependency lines (base geometry; renderer re-builds per page for correctness)
  const depLines: PrintDepLine[] = [];
  if (options.includeDependencies && deps.length) {
    const idxById = new Map<string, number>();
    for (const pr of printRows) idxById.set(pr.id, pr.index);

    const barByRow = new Map<string, PrintBar>();
    for (const b of bars) barByRow.set(b.rowId, b);

    for (const link of deps) {
      const fromIdx = idxById.get(link.fromRowId);
      const toIdx = idxById.get(link.toRowId);
      if (fromIdx === undefined || toIdx === undefined) continue;

      const fromBar = barByRow.get(link.fromRowId);
      const toBar = barByRow.get(link.toRowId);
      if (!fromBar || !toBar) continue;

      const fromIsStart = link.type === "SS" || link.type === "SF";
      const toIsEnd = link.type === "FF" || link.type === "SF";

      const rowH = options.rowHeightPx;
      const stub = 10;
      const padX = 14;

      const fromX = fromIsStart ? fromBar.x : (fromBar.x + fromBar.w);
      const toX = toIsEnd ? (toBar.x + toBar.w) : toBar.x;

      const fromY = ganttPx.y + fromIdx * rowH + rowH / 2;
      const toY = ganttPx.y + toIdx * rowH + rowH / 2;

      const dir = toX >= fromX ? 1 : -1;

      const fromStubX = fromX + dir * stub;
      const toStubX = toX - dir * stub;

      const laneXRaw =
        dir > 0 ? Math.max(fromX, toX) + padX : Math.min(fromX, toX) - padX;

      const laneX = clamp(laneXRaw, ganttPx.x, ganttPx.x + ganttPx.w);

      const laneY =
        toIdx >= fromIdx
          ? ganttPx.y + (fromIdx + 1) * rowH - 2
          : ganttPx.y + fromIdx * rowH + 2;

      let points: Array<{ x: number; y: number }> = [];

      if (fromIdx === toIdx) {
        points = [
          { x: fromX, y: fromY },
          { x: fromStubX, y: fromY },
          { x: toStubX, y: toY },
          { x: toX, y: toY },
        ];
      } else {
        points = [
          { x: fromX, y: fromY },
          { x: fromStubX, y: fromY },
          { x: laneX, y: fromY },
          { x: laneX, y: laneY },
          { x: toStubX, y: laneY },
          { x: toStubX, y: toY },
          { x: toX, y: toY },
        ];
      }

      depLines.push({
        fromRowId: link.fromRowId,
        toRowId: link.toRowId,
        points,
        type: String(link.type),
        lagDays: Number(link.lagDays ?? 0),
        valid: Boolean(link.valid),
      });
    }
  }

  return {
    options,
    columns,
    rows: printRows,
    range,
    layout,
    bars,
    depLines,
    meta: {
      startKey,
      endKey,
      filteredOutRowCount,
      keptBecauseParent,
    },
  };
}
