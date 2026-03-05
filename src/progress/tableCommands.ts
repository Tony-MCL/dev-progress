// src/progress/tableCommands.ts
import type { ColumnDef, RowData, Selection } from "../core/TableTypes";

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
