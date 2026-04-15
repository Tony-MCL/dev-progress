// src/core/TableTypes.ts

export type CellValue = string | number | null | undefined;

export type ColumnDef = {
  key: string;
  title: string;
  type?: "text" | "number" | "date" | "datetime" | "select";
  width?: number;
  summarizable?: boolean;
  isTitle?: boolean;
  dateRole?: "start" | "end";
  selectOptions?: Array<{ value: string; label: string }>;
};

export type RowData = {
  id: string;
  indent: number;
  cells: Record<string, CellValue>;
};

export type Selection = {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
};

export type TableCoreUIOptions = {
  fontSizePx?: number;
  rowHeightPx?: number;
  colors?: {
    bg?: string;
    fg?: string;
    grid?: string;
    accent?: string;
    sel?: string;
    selBorder?: string;
    editBg?: string;
  };
};

/** Knutepunkt: når en celle commits (for app-lag/undo/validering) */
export type TableCoreCellCommit = {
  row: number;
  col: number;
  columnKey: string;
  prev: CellValue;
  next: CellValue;
};

/* ============================================================
   DATEPICKER (app-owned): request + preview
   ============================================================ */

export type TableCoreDatePreview =
  | { row: number; col: number; raw: string }
  | null;

export type TableCoreDatePickerRequest = {
  row: number;
  col: number;
  column: ColumnDef;
  currentValue: CellValue;
  anchorRect: DOMRect | null;
  mode: "view" | "edit";

  // Final commit (TableCore gjør parsing/formatting selv)
  commit: (raw: string, opts?: { endEdit?: boolean }) => void;

  // For Tab/Enter-navigasjon når picker er åpen
  move: (kind: "tab" | "enter", shift: boolean) => void;

  close: () => void;
};

/* ============================================================
   CONTEXT MENU (app-owned): generic request
   ============================================================ */

export type TableCoreContextMenuRequest = {
  area: "cell" | "rowHeader" | "columnHeader" | "tableBody";
  clientX: number;
  clientY: number;
  targetRect: DOMRect | null;
  selection: Selection;

  row: number | null;
  col: number | null;
  rowId?: string;
  column?: ColumnDef;
  currentValue?: CellValue;
};

export type TableCoreProps = {
  columns: ColumnDef[];
  rows: RowData[];
  onChange: (next: RowData[]) => void;
  onColumnsChange?: (nextColumns: ColumnDef[]) => void;

  // Sammendrag
  showSummary?: boolean;
  summaryValues?: Record<string, CellValue>;
  summaryTitle?: string;

  // UI-innstillinger fra appen
  ui?: TableCoreUIOptions;

  /** Visningsformat for datoer */
  dateFormat?: string; // f.eks. "dd.mm.yyyy", "mm/dd/yyyy", "yyyy-mm-dd"

  /** Hook for å åpne ekstern datepicker (app-owned popover) */
  onRequestDatePicker?: (req: TableCoreDatePickerRequest) => void;

  /** Hook for å åpne app-owned context menu */
  onRequestContextMenu?: (req: TableCoreContextMenuRequest) => void;

  /** Preview fra appen: vis valgt dato uten commit (før outside/Tab/Enter) */
  datePreview?: TableCoreDatePreview;

  /** Knutepunkt: selection endres */
  onSelectionChange?: (sel: Selection) => void;

  /** Knutepunkt: editing start/stop */
  onEditingChange?: (editing: { r: number; c: number } | null) => void;

  /** Knutepunkt: commit av celleverdi */
  onCellCommit?: (evt: TableCoreCellCommit) => void;

  /**
   * ✅ Sticky “prosjektinfo”-linje over kolonneheader.
   * - Bruk demo-tekst nå.
   * - Senere kan Progress hente denne fra DB (prosjektmetadata).
   */
  headerInfoText?: string;

  /**
   * ✅ Nytt generisk knutepunkt:
   * Gir app-laget listen av "synlige" rader (etter collapse/expand).
   * - Ingen domene-logikk
   * - Kun UI-state eksport
   */
  onVisibleRowIdsChange?: (visibleRowIds: string[]) => void;
};
