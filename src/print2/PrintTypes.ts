// src/print2/PrintTypes.ts
import type { ColumnDef, RowData } from "../core/TableTypes";
import type { DepLink } from "../progress/ProgressCore";

export type PageSize = "A4" | "A3";
export type Orientation = "landscape";

export type PrintOptions = {
  pageSize: PageSize;          // A4 | A3
  orientation: Orientation;    // landscape (låst i V1)
  includeDependencies: boolean;

  // Marginer i mm (for deterministisk layout)
  marginMm?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };

  // Rendering-kontrakter (kan tweakes senere uten DOM)
  rowHeightPx?: number;      // default 28
  barHeightPx?: number;      // default 12
  barInsetYPx?: number;      // default 8  (rowHeight - 2*inset >= barHeight)
  tableMaxWidthPx?: number;  // default 520 (venstre tabell i print)
  tableMinWidthPx?: number;  // default 360
};

export type PrintInput = {
  columns: ColumnDef[];
  rows: RowData[];

  // Avhengigheter: kommer ferdig pars’et fra eksisterende app-lag
  dependencies?: DepLink[];

  // Valgfritt (for senere): eierfarger osv.
  ownerColors?: Record<string, string>;

  // ✅ NY: global default bar color (fra toolbar)
  defaultBarColor?: string;
};

export type TimeScale = "day" | "week" | "month" | "year";

export type PrintRange = {
  startISO: string; // YYYY-MM-DD (midnight)
  endISO: string;   // YYYY-MM-DD (midnight)
  totalDays: number;
};

export type PrintRow = {
  id: string;
  indent: number;

  // “Printbare” celler (stringified)
  cells: Record<string, string>;

  // For gantt
  startISO: string | null;
  endISO: string | null;

  // Index i print (for y-pos)
  index: number;
};

export type PrintBar = {
  rowId: string;
  x: number;
  y: number;
  w: number;
  h: number;

  startISO: string;
  endISO: string;

  // valgfritt
  color?: string;
};

export type PrintDepLine = {
  fromRowId: string;
  toRowId: string;

  // polyline points i print-koordinater
  points: Array<{ x: number; y: number }>;

  type: string;    // FS/SS/FF/SF (string for renderer)
  lagDays: number; // workdays i dagens deps-modell
  valid: boolean;
};

export type PrintLayout = {
  // Side i px (96dpi) + content-rect i px etter marginer
  pagePx: { w: number; h: number };
  contentPx: { x: number; y: number; w: number; h: number };

  // Venstre tabell og høyre gantt-område
  tablePx: { x: number; y: number; w: number; h: number };
  ganttPx: { x: number; y: number; w: number; h: number };

  // Skala
  pxPerDay: number;
  scale: TimeScale;

  // Kontrakter
  rowHeightPx: number;
  barHeightPx: number;
  barInsetYPx: number;
};

export type PrintModel = {
  options: Required<PrintOptions>;
  columns: ColumnDef[];

  // Printbare rader (filtrert)
  rows: PrintRow[];

  // Datoområde for hele printen
  range: PrintRange;

  // Layout (deterministiske tall)
  layout: PrintLayout;

  // Ferdig beregnet grafikkdata
  bars: PrintBar[];
  depLines: PrintDepLine[];

  // Info/diagnostics (valgfritt for UI)
  meta: {
    startKey: string | null;
    endKey: string | null;
    filteredOutRowCount: number;
    keptBecauseParent: number;
  };
};
