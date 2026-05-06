// src/progress/tableCommands.ts
import type { ColumnDef, RowData, Selection } from "../core/TableTypes";
import { parseClipboard, toTSV } from "../core/utils/clipboard";

export type AppColumnDef = ColumnDef & {
  visible?: boolean; // default true
  custom?: boolean; // default false
};

export function getVisibleColumns(cols: AppColumnDef[]): ColumnDef[] {
  return cols.filter((c) => c.visible !== false);
}

export function ensureAtLeastTitleVisible(cols: AppColumnDef[]): AppColumnDef[] {
  const hasTitleVisible = cols.some((c) => c.isTitle && c.visible !== false);
  if (hasTitleVisible) return cols;
  return cols.map((c) => (c.isTitle ? { ...c, visible: true } : c));
}

export function applyColumnsToRows(cols: AppColumnDef[], rows: RowData[]): RowData[] {
  const keys = cols.map((c) => c.key);
  let changed = false;

  const next = rows.map((r) => {
    const cells = { ...(r.cells as any) };
    for (const k of keys) {
      if (!(k in cells)) {
        cells[k] = "";
        changed = true;
      }
    }
    return changed ? { ...r, cells } : r;
  });

  return changed ? next : rows;
}

function slugKey(label: string) {
  const s = (label ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "");
  return s || "col";
}

export function makeUniqueColumnKey(existing: AppColumnDef[], label: string) {
  const base = slugKey(label);
  const used = new Set(existing.map((c) => c.key));
  if (!used.has(base)) return base;
  let i = 2;
  while (used.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}

export function addCustomColumn(
  cols: AppColumnDef[],
  spec: { title: string; type?: "text" | "number" | "date"; width?: number }
): AppColumnDef[] {
  const title = (spec.title ?? "").trim();
  if (!title) return cols;

  const key = makeUniqueColumnKey(cols, title);
  const type = spec.type ?? "text";

  const width =
    typeof spec.width === "number"
      ? spec.width
      : type === "text"
        ? 200
        : 140;

  const next: AppColumnDef = {
    key,
    title,
    width,
    type: type === "text" ? undefined : type,
    custom: true,
    visible: true,
  };

  return [...cols, next];
}

/* =========================
   RADER: helpers/commands
   ========================= */

function nextRowId(rows: RowData[]) {
  let max = 0;
  for (const r of rows) {
    const m = String(r.id).match(/^r(\d+)$/);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `r${max + 1}`;
}

export function makeBlankRow(cols: AppColumnDef[], rowsSnapshotForId: RowData[], indent = 0): RowData {
  const cells: Record<string, any> = {};
  for (const c of cols) cells[c.key] = "";
  return { id: nextRowId(rowsSnapshotForId), indent, cells };
}

export function ensureMinRows(rows: RowData[], cols: AppColumnDef[], minRows: number): RowData[] {
  if (rows.length >= minRows) return rows;
  const next = [...rows];
  while (next.length < minRows) {
    next.push(makeBlankRow(cols, next, 0));
  }
  return next;
}

export function addRowAtEnd(rows: RowData[], cols: AppColumnDef[], minRows = 120): RowData[] {
  const next = [...rows, makeBlankRow(cols, rows, 0)];
  return ensureMinRows(next, cols, minRows);
}

/** Normalize selection => {rMin,rMax} (absolute indices in rows-array) */
export function selectionRange(sel: Selection | null, rowCount: number): { rMin: number; rMax: number } | null {
  if (!sel) return null;
  const a = Number(sel.r1);
  const b = Number(sel.r2);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;

  const rMin = Math.max(0, Math.min(rowCount - 1, Math.min(a, b)));
  const rMax = Math.max(0, Math.min(rowCount - 1, Math.max(a, b)));

  if (rowCount <= 0) return null;
  return { rMin, rMax };
}

/** Insert a row right AFTER the last selected row (or at end if selection is invalid) */
export function addRowBelowSelection(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null,
  minRows = 120
): RowData[] {
  if (!rows.length) {
    const seeded = ensureMinRows([], cols, Math.max(1, minRows));
    return seeded;
  }

  const range = selectionRange(sel, rows.length);
  if (!range) {
    // fallback: add at end
    return addRowAtEnd(rows, cols, minRows);
  }

  const afterIdx = range.rMax;
  const baseIndent = rows[afterIdx]?.indent ?? 0;

  const next = rows.map((r) => r); // shallow
  const newRow = makeBlankRow(cols, next, baseIndent);

  next.splice(afterIdx + 1, 0, newRow);
  return ensureMinRows(next, cols, minRows);
}

/** Insert a row right BEFORE the first selected row */
export function addRowAboveSelection(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null,
  minRows = 120
): RowData[] {
  if (!rows.length) {
    const seeded = ensureMinRows([], cols, Math.max(1, minRows));
    return seeded;
  }

  const range = selectionRange(sel, rows.length);
  if (!range) {
    // fallback: add at top
    const next = [...rows];
    const newRow = makeBlankRow(cols, next, 0);
    next.unshift(newRow);
    return ensureMinRows(next, cols, minRows);
  }

  const beforeIdx = range.rMin;
  const baseIndent = rows[beforeIdx]?.indent ?? 0;

  const next = rows.map((r) => r);
  const newRow = makeBlankRow(cols, next, baseIndent);

  next.splice(beforeIdx, 0, newRow);
  return ensureMinRows(next, cols, minRows);
}

/** Delete selected rows (range). Keeps at least minRows by padding blanks. */
export function deleteSelectedRows(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null,
  minRows = 120
): RowData[] {
  if (!rows.length) return ensureMinRows([], cols, minRows);

  const range = selectionRange(sel, rows.length);
  if (!range) return rows;

  const { rMin, rMax } = range;

  // If selection covers all rows, we just reset to blank minRows.
  if (rMin === 0 && rMax === rows.length - 1) {
    return ensureMinRows([], cols, minRows);
  }

  const next = rows.slice(0, rMin).concat(rows.slice(rMax + 1));
  return ensureMinRows(next, cols, minRows);
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export function selectionRect(
  sel: Selection | null,
  rowCount: number,
  colCount: number
):
  | { rMin: number; rMax: number; cMin: number; cMax: number }
  | null {
  if (!sel) return null;

  const r1 = Number(sel.r1);
  const r2 = Number(sel.r2);
  const c1 = Number(sel.c1);
  const c2 = Number(sel.c2);

  if (![r1, r2, c1, c2].every(Number.isFinite)) return null;
  if (rowCount <= 0 || colCount <= 0) return null;

  return {
    rMin: clamp(Math.min(r1, r2), 0, rowCount - 1),
    rMax: clamp(Math.max(r1, r2), 0, rowCount - 1),
    cMin: clamp(Math.min(c1, c2), 0, colCount - 1),
    cMax: clamp(Math.max(c1, c2), 0, colCount - 1),
  };
}

export function selectionToTsv(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null
): string {
  const rect = selectionRect(sel, rows.length, cols.length);
  if (!rect) return "";

  const matrix: (string | number | "")[][] = [];

  for (let r = rect.rMin; r <= rect.rMax; r++) {
    const line: (string | number | "")[] = [];
    for (let c = rect.cMin; c <= rect.cMax; c++) {
      const key = cols[c]?.key;
      line.push(key ? (rows[r]?.cells?.[key] ?? "") : "");
    }
    matrix.push(line);
  }

  return toTSV(matrix);
}

export function clearSelectionCells(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null
): RowData[] {
  const rect = selectionRect(sel, rows.length, cols.length);
  if (!rect) return rows;

  const next = rows.map((r) => ({ ...r, cells: { ...r.cells } }));

  for (let r = rect.rMin; r <= rect.rMax; r++) {
    for (let c = rect.cMin; c <= rect.cMax; c++) {
      const key = cols[c]?.key;
      if (!key) continue;
      next[r].cells[key] = "";
    }
  }

  return next;
}

export function pasteTextIntoSelection(
  rows: RowData[],
  cols: AppColumnDef[],
  sel: Selection | null,
  text: string
): RowData[] {
  const rect = selectionRect(sel, rows.length, cols.length);
  if (!rect) return rows;
  if (!text.trim()) return rows;

  const matrix = parseClipboard(text);
  if (!matrix.length) return rows;

  const next = rows.map((r) => ({ ...r, cells: { ...r.cells } }));

  for (let i = 0; i < matrix.length; i++) {
    const rr = rect.rMin + i;
    if (rr >= next.length) break;

    for (let j = 0; j < matrix[i].length; j++) {
      const cc = rect.cMin + j;
      if (cc >= cols.length) break;

      const key = cols[cc]?.key;
      if (!key) continue;

      next[rr].cells[key] = matrix[i][j] as any;
    }
  }

  return next;
}

export function indentSelectedRows(
  rows: RowData[],
  sel: Selection | null
): RowData[] {
  const range = selectionRange(sel, rows.length);
  if (!range) return rows;

  const next = rows.map((r) => ({ ...r }));

  for (let i = range.rMin; i <= range.rMax; i++) {
    const prevIndent = i > 0 ? next[i - 1].indent : 0;
    const maxIndent = prevIndent + 1;
    next[i].indent = clamp((next[i].indent ?? 0) + 1, 0, maxIndent);
  }

  return next;
}

export function outdentSelectedRows(
  rows: RowData[],
  sel: Selection | null
): RowData[] {
  const range = selectionRange(sel, rows.length);
  if (!range) return rows;

  const next = rows.map((r) => ({ ...r }));

  for (let i = range.rMin; i <= range.rMax; i++) {
    next[i].indent = clamp((next[i].indent ?? 0) - 1, 0, 999);
  }

  return next;
}

export function isRowMilestone(row: RowData | null | undefined): boolean {
  const cells = (row as any)?.cells ?? {};
  return String(cells.__progressMilestone ?? "").trim() !== "";
}

export function hasMilestoneInSelection(
  rows: RowData[],
  sel: Selection | null
): boolean {
  const range = selectionRange(sel, rows.length);
  if (!range) return false;

  for (let i = range.rMin; i <= range.rMax; i++) {
    if (isRowMilestone(rows[i])) return true;
  }

  return false;
}

export function toggleSelectedRowsMilestone(
  rows: RowData[],
  sel: Selection | null,
  anchor: "start" | "end" = "start"
): RowData[] {
  const range = selectionRange(sel, rows.length);
  if (!range) return rows;

  const shouldRemove = hasMilestoneInSelection(rows, sel);

  return rows.map((row, idx) => {
    if (idx < range.rMin || idx > range.rMax) return row;

    const cells = { ...(row.cells as any) };

    if (shouldRemove) {
      delete cells.__progressMilestone;
      delete cells.__progressMilestoneAnchor;
    } else {
      cells.__progressMilestone = "1";
      cells.__progressMilestoneAnchor = anchor;
    }

    return {
      ...row,
      cells,
    };
  });
}

function parseProgressDateLoose(value: any): Date | null {
  const s = String(value ?? "").trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    const dd = Number(dmy[1]);
    const mm = Number(dmy[2]);
    const yyyy = Number(dmy[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(+d) ? null : d;
  }

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    const d = new Date(yyyy, mm - 1, dd);
    return Number.isNaN(+d) ? null : d;
  }

  return null;
}

function diffProgressDays(a: Date, b: Date): number {
  const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((+bb - +aa) / 86400000);
}

export function selectionNeedsMilestoneAnchorChoice(
  rows: RowData[],
  sel: Selection | null
): boolean {
  const range = selectionRange(sel, rows.length);
  if (!range) return false;

  for (let i = range.rMin; i <= range.rMax; i++) {
    const row = rows[i];
    const cells = (row as any)?.cells ?? {};

    if (isRowMilestone(row)) continue;

    const title = String(cells.title ?? "").trim();
    const start = parseProgressDateLoose(cells.start);
    const end = parseProgressDateLoose(cells.end);

    if (!title || !start || !end) continue;

    const durationDays = diffProgressDays(start, end) + 1;

    if (durationDays > 1) return true;
  }

  return false;
}
