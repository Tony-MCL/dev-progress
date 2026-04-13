// src/core/TableCore.tsx
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  ColumnDef,
  RowData,
  Selection,
  TableCoreProps,
  CellValue,
  TableCoreCellCommit,
  TableCoreDatePickerRequest,
} from "./TableTypes";
import { parseClipboard, toTSV } from "./utils/clipboard";
import { useI18n } from "../i18n";
import "../styles/tablecore.css";

/* ============================================================
   DATOHÅNDTERING: PARSING + FORMATERING ETTER VALGT MØNSTER
   ============================================================ */

function parseDateFlexible(input: string, patternHint?: string): Date | null {
  if (!input) return null;
  const t = input.trim();
  if (!t) return null;

  const iso = t.match(
    /^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2})(?::(\d{2}))?)?$/
  );
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    const hh = iso[4] != null ? Number(iso[4]) : 0;
    const mi = iso[5] != null ? Number(iso[5]) : 0;
    const ss = iso[6] != null ? Number(iso[6]) : 0;

    const d = new Date(yyyy, mm - 1, dd, hh, mi, ss);
    return isNaN(+d) ? null : d;
  }

  const dot = t.match(
    /^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (dot) {
    const dd = Number(dot[1]);
    const mm = Number(dot[2]);
    const yyyy = Number(dot[3]);
    const hh = dot[4] != null ? Number(dot[4]) : 0;
    const mi = dot[5] != null ? Number(dot[5]) : 0;

    const d = new Date(yyyy, mm - 1, dd, hh, mi, 0);
    return isNaN(+d) ? null : d;
  }

  const slash = t.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (slash) {
    const a = Number(slash[1]);
    const b = Number(slash[2]);
    const yyyy = Number(slash[3]);
    const hh = slash[4] != null ? Number(slash[4]) : 0;
    const mi = slash[5] != null ? Number(slash[5]) : 0;

    let dd: number;
    let mm: number;

    if (a > 12 && b <= 12) {
      dd = a;
      mm = b;
    } else if (b > 12 && a <= 12) {
      mm = a;
      dd = b;
    } else {
      const prefersDMY = (patternHint ?? "").toLowerCase().startsWith("dd");
      if (prefersDMY || !patternHint) {
        dd = a;
        mm = b;
      } else {
        mm = a;
        dd = b;
      }
    }

    const d = new Date(yyyy, mm - 1, dd, hh, mi, 0);
    return isNaN(+d) ? null : d;
  }

  return null;
}

function formatDateByPattern(date: Date | null, pattern: string): string {
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");

  return pattern
    .replace("yyyy", String(yyyy))
    .replace("mm", mm)
    .replace("dd", dd);
}

function formatDatetimeByPattern(date: Date | null, pattern: string): string {
  if (!date) return "";
  const base = formatDateByPattern(date, pattern);
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${base} ${hh}:${mi}`;
}

/* ============================================================
   HJELPERE
   ============================================================ */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function isNumericColumn(col: ColumnDef) {
  return col.type === "number";
}
function isDateColumn(col: ColumnDef) {
  return col.type === "date" || col.type === "datetime";
}
function isSelectColumn(col: ColumnDef) {
  return (col as any).type === "select";
}

function rowHasContent(row: RowData, cols: ColumnDef[]) {
  return cols.some((c) => c.key !== "#" && row.cells[c.key]);
}
function makeGridTemplate(cols: ColumnDef[]) {
  return ["48px", ...cols.map((c) => `${c.width ?? 160}px`)].join(" ");
}

const DRAG_THRESHOLD_PX = 4;

const NOSEL: Selection = { r1: -1, c1: -1, r2: -1, c2: -1 };
const hasSel = (s: Selection) =>
  s.r1 >= 0 && s.c1 >= 0 && s.r2 >= 0 && s.c2 >= 0;

type EditMode = "replace" | "caretEnd" | "selectAll";
type EditingState =
  | { r: number; c: number; mode: EditMode; seed?: string }
  | null;

/* ============================================================
   PARENT/CHILD (KUN STRUKTUR)
   ============================================================ */

type HasChildren = Set<number>;

function computeHasChildren(rows: RowData[]): HasChildren {
  const childrenMap: Map<number, number[]> = new Map();
  const stack: Array<{ idx: number; indent: number }> = [];

  for (let i = 0; i < rows.length; i++) {
    const indent = rows[i].indent;
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
    const parentIdx = stack.length ? stack[stack.length - 1].idx : -1;
    if (parentIdx >= 0) {
      if (!childrenMap.has(parentIdx)) childrenMap.set(parentIdx, []);
      childrenMap.get(parentIdx)!.push(i);
    }
    stack.push({ idx: i, indent });
  }

  return new Set(Array.from(childrenMap.keys()));
}

/* ============================================================
   KOMPONENT
   ============================================================ */

export default function TableCore(props: TableCoreProps) {
  const { t } = useI18n();

  const onRowContextMenu = (props as any).onRowContextMenu as
    | ((args: { row: number; x: number; y: number }) => void)
    | undefined;

  const {
    columns,
    rows,
    onChange,
    showSummary = false,
    summaryValues,
    summaryTitle = t("tableCore.summaryTitle"),
    ui,
    dateFormat = "dd.mm.yyyy",
    onRequestDatePicker,
    datePreview,
    onSelectionChange,
    onEditingChange,
    onCellCommit,
    headerInfoText,
    onVisibleRowIdsChange,
    onColumnsChange,
  } = props;

  void showSummary;
  void summaryValues;
  void summaryTitle;

  const data = rows;

  const [cols, setCols] = useState<ColumnDef[]>(columns);
  useEffect(() => setCols(columns), [columns]);

  const setAndPropagate = useCallback(
    (next: RowData[]) => {
      onChange(next);
    },
    [onChange]
  );

  const [sel, setSel] = useState<Selection>(NOSEL);

  const [editing, _setEditing] = useState<EditingState>(null);
  const editingRef = useRef<EditingState>(null);
  const setEditingBoth = useCallback(
    (next: EditingState) => {
      editingRef.current = next;
      _setEditing(next);
      onEditingChange?.(next ? { r: next.r, c: next.c } : null);
    },
    [onEditingChange]
  );

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [rowDropHint, setRowDropHint] = useState<
    { idx: number; after: boolean } | null
  >(null);

  void setRowDropHint;

  const toggleCollapsed = useCallback((rowId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }, []);

  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef<{
    active: boolean;
    dragging: boolean;
    r0: number;
    c0: number;
    x0: number;
    y0: number;
  } | null>(null);

  const suppressClickToEditOnce = useRef(false);

  const editSessionIdRef = useRef(0);
  const lastCommittedSessionRef = useRef<number | null>(null);

  const dataRef = useRef(data);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const colsRef = useRef(cols);
  useEffect(() => {
    colsRef.current = cols;
  }, [cols]);

  const dragRowIndexRef = useRef<number | null>(null);

  const selRef = useRef(sel);
  useEffect(() => {
    selRef.current = sel;
    onSelectionChange?.(sel);
  }, [sel, onSelectionChange]);

  const [editValue, _setEditValue] = useState<string>("");
  const editValueRef = useRef<string>("");
  const setEditValueBoth = useCallback((v: string) => {
    editValueRef.current = v;
    _setEditValue(v);
  }, []);

  const editorTextAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    if (!editing) return;

    const el = editorTextAreaRef.current;
    if (!el) return;

    requestAnimationFrame(() => {
      try {
        el.focus({ preventScroll: true } as any);
      } catch {
        try {
          el.focus();
        } catch {}
      }

      try {
        if (editing.mode === "selectAll") el.select();
        else {
          const end = el.value.length;
          el.setSelectionRange(end, end);
        }
      } catch {}
    });
  }, [editing]);

  const rootStyleVars = useMemo(
    () =>
      ({
        ...(ui?.fontSizePx ? { "--tc-font-size": `${ui.fontSizePx}px` } : {}),
        ...(ui?.rowHeightPx ? { "--tc-row-h": `${ui.rowHeightPx}px` } : {}),
        ...(ui?.colors?.bg ? { "--tc-bg": ui.colors.bg } : {}),
        ...(ui?.colors?.fg ? { "--tc-fg": ui.colors.fg } : {}),
        ...(ui?.colors?.grid ? { "--tc-grid": ui.colors.grid } : {}),
        ...(ui?.colors?.accent ? { "--tc-accent": ui.colors.accent } : {}),
        ...(ui?.colors?.sel ? { "--tc-sel": ui.colors.sel } : {}),
        ...(ui?.colors?.selBorder
          ? { "--tc-sel-border": ui.colors.selBorder }
          : {}),
        ...(ui?.colors?.editBg ? { "--tc-edit-bg": ui.colors.editBg } : {}),
      }) as React.CSSProperties,
    [ui]
  );

  const wrapStyle = useMemo(
    () =>
      ({
        // CSS styrer overflow/høyde
      }) as React.CSSProperties,
    []
  );

  const commitCellValue = useCallback(
    (r: number, c: number, raw: string, opts?: { endEdit?: boolean }) => {
      const col = colsRef.current[c];
      const prev = dataRef.current[r]?.cells?.[col.key];

      let parsed: CellValue = raw;

      if (isNumericColumn(col)) {
        parsed = raw === "" ? "" : Number(raw);
      } else if (isDateColumn(col)) {
        const d = parseDateFlexible(raw, dateFormat);
        if (col.type === "datetime")
          parsed = d ? formatDatetimeByPattern(d, dateFormat) : raw;
        else parsed = d ? formatDateByPattern(d, dateFormat) : raw;
      } else if (isSelectColumn(col)) {
        parsed = String(raw ?? "");
      }

      const next = dataRef.current.map((row, i) =>
        i === r ? { ...row, cells: { ...row.cells, [col.key]: parsed } } : row
      );

      setAndPropagate(next);

      const evt: TableCoreCellCommit = {
        row: r,
        col: c,
        columnKey: col.key,
        prev,
        next: parsed,
      };
      onCellCommit?.(evt);

      if (opts?.endEdit) setEditingBoth(null);
    },
    [dateFormat, onCellCommit, setAndPropagate, setEditingBoth]
  );

  const commitEdit = useCallback(
    (r: number, c: number, val: string) => {
      const sessionId = editSessionIdRef.current;
      if (lastCommittedSessionRef.current === sessionId) return;
      lastCommittedSessionRef.current = sessionId;

      commitCellValue(r, c, val, { endEdit: true });
    },
    [commitCellValue]
  );

  const startEditing = useCallback(
    (next: NonNullable<EditingState>) => {
      editSessionIdRef.current += 1;
      lastCommittedSessionRef.current = null;

      const col = colsRef.current[next.c];
      const storedVal = dataRef.current[next.r]?.cells?.[col.key] ?? "";
      const initial =
        next.mode === "replace"
          ? String(next.seed ?? "")
          : String(storedVal ?? "");
      setEditValueBoth(initial);

      setEditingBoth(next);
    },
    [setEditValueBoth, setEditingBoth]
  );

  const hasChildren = useMemo(() => computeHasChildren(data), [data]);

  const visibleRowIndices = useMemo(() => {
    const result: number[] = [];
    const st: Array<{ id: string; indent: number; collapsed: boolean }> = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      while (st.length && st[st.length - 1].indent >= row.indent) st.pop();
      const hidden = st.some((a) => a.collapsed);
      if (!hidden) result.push(i);

      const isParent = hasChildren.has(i);
      st.push({
        id: row.id,
        indent: row.indent,
        collapsed: isParent ? collapsed.has(row.id) : false,
      });
    }

    return result;
  }, [data, hasChildren, collapsed]);

  useEffect(() => {
    if (!onVisibleRowIdsChange) return;
    const ids = visibleRowIndices
      .map((i) => data[i]?.id)
      .filter(Boolean) as string[];
    onVisibleRowIdsChange(ids);
  }, [onVisibleRowIdsChange, visibleRowIndices, data]);

  const nextPosAfter = (
    r: number,
    c: number,
    dir: "down" | "up" | "right" | "left"
  ) => {
    const visible = visibleRowIndices;
    const idxInVisible = visible.indexOf(r);
    const colMax = colsRef.current.length - 1;

    if (idxInVisible === -1) {
      const nearest =
        visible.find((v) => v >= r) ?? visible[visible.length - 1];
      return { r: nearest ?? r, c };
    }

    let vi = idxInVisible;

    if (dir === "down") vi = Math.min(visible.length - 1, vi + 1);
    if (dir === "up") vi = Math.max(0, vi - 1);

    if (dir === "right") {
      let cc = c + 1,
        rr = r;
      if (cc > colMax) {
        cc = 0;
        vi = Math.min(visible.length - 1, vi + 1);
        rr = visible[vi];
      }
      return { r: rr, c: cc };
    }

    if (dir === "left") {
      let cc = c - 1,
        rr = r;
      if (cc < 0) {
        cc = colMax;
        vi = Math.max(0, vi - 1);
        rr = visible[vi];
      }
      return { r: rr, c: cc };
    }

    return { r: visible[vi], c };
  };

  const indentRow = (rowIdx: number, delta: number) => {
    const arr = dataRef.current;
    const cur = arr[rowIdx];
    if (!cur) return;
    const prevIndent = rowIdx > 0 ? arr[rowIdx - 1].indent : 0;
    const maxIndent = prevIndent + 1;
    const desired = cur.indent + delta;
    const nextIndent = clamp(desired, 0, maxIndent);
    if (nextIndent === cur.indent) return;

    setAndPropagate(
      arr.map((r, i) => (i === rowIdx ? { ...r, indent: nextIndent } : r))
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tEl = e.target as HTMLElement | null;
      if (tEl) {
        const tag = tEl.tagName;
        const isFormField =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          (tEl as any).isContentEditable;

        const inDialog =
          !!tEl.closest(
            '[role="dialog"], [aria-modal="true"], .ptb-modal, .ptb-modal-backdrop'
          );

        if (isFormField || inDialog) return;
      }

      if (editingRef.current) return;

      const colMax = colsRef.current.length - 1;
      const curSel = selRef.current;

      if (
        e.altKey &&
        !e.shiftKey &&
        (e.key === "ArrowLeft" || e.key === "ArrowRight")
      ) {
        if (!hasSel(curSel)) return;
        e.preventDefault();
        indentRow(curSel.r1, e.key === "ArrowRight" ? 1 : -1);
        return;
      }

      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab", "Enter"].includes(
          e.key
        )
      ) {
        if (!hasSel(curSel)) return;
        e.preventDefault();

        let r = curSel.r1,
          c = curSel.c1;

        if (e.key === "ArrowUp") r = nextPosAfter(r, c, "up").r;
        if (e.key === "ArrowDown") r = nextPosAfter(r, c, "down").r;
        if (e.key === "ArrowLeft") c = clamp(c - 1, 0, colMax);
        if (e.key === "ArrowRight") c = clamp(c + 1, 0, colMax);
        if (e.key === "Tab") {
          const n = nextPosAfter(r, c, e.shiftKey ? "left" : "right");
          r = n.r;
          c = n.c;
        }
        if (e.key === "Enter") {
          const n = nextPosAfter(r, c, e.shiftKey ? "up" : "down");
          r = n.r;
          c = n.c;
        }

        setSel({ r1: r, r2: r, c1: c, c2: c });
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        if (!hasSel(curSel)) return;
        e.preventDefault();
        startEditing({
          r: curSel.r1,
          c: curSel.c1,
          mode: "replace",
          seed: e.key,
        });
        return;
      }

      if (e.key === "F2") {
        if (!hasSel(curSel)) return;
        e.preventDefault();
        startEditing({ r: curSel.r1, c: curSel.c1, mode: "caretEnd" });
        return;
      }
    };

    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [startEditing]);

  const setGlobalNoSelect = (on: boolean) => {
    const el = rootRef.current;
    if (!el) return;
    el.classList.toggle("tc-noselect", on);
  };

  const onCellMouseDown = (r: number, c: number) => (ev: React.MouseEvent) => {
    setSel({ r1: r, r2: r, c1: c, c2: c });
    dragState.current = {
      active: true,
      dragging: false,
      r0: r,
      c0: c,
      x0: ev.clientX,
      y0: ev.clientY,
    };
  };

  const onMouseMove = (ev: React.MouseEvent) => {
    if (!dragState.current || !dragState.current.active) return;
    const dx = ev.clientX - dragState.current.x0;
    const dy = ev.clientY - dragState.current.y0;

    if (
      !dragState.current.dragging &&
      dx * dx + dy * dy > DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX
    ) {
      dragState.current.dragging = true;
      setGlobalNoSelect(true);
    }
    if (!dragState.current.dragging) return;

    const tgt = (ev.target as HTMLElement).closest("[data-cell]") as
      | HTMLElement
      | null;
    if (!tgt) return;

    const r = Number(tgt.getAttribute("data-r"));
    const c = Number(tgt.getAttribute("data-c"));

    setSel({
      r1: Math.min(r, dragState.current.r0),
      r2: Math.max(r, dragState.current.r0),
      c1: Math.min(c, dragState.current.c0),
      c2: Math.max(c, dragState.current.c0),
    });
  };

  const onMouseUp = () => {
    if (!dragState.current) return;
    dragState.current.active = false;
    dragState.current.dragging = false;
    setGlobalNoSelect(false);

    if (suppressClickToEditOnce.current) {
      suppressClickToEditOnce.current = false;
      return;
    }
  };

  const findCellRect = (r: number, c: number): DOMRect | null => {
    const root = rootRef.current;
    if (!root) return null;
    const el = root.querySelector(
      `[data-cell][data-r="${r}"][data-c="${c}"]`
    ) as HTMLElement | null;
    if (!el) return null;
    return el.getBoundingClientRect();
  };

  const requestDatePicker = useCallback(
    (r: number, c: number, mode: "view" | "edit") => {
      const col = colsRef.current[c];
      if (!isDateColumn(col)) return;
      if (!onRequestDatePicker) return;

      const current = dataRef.current[r]?.cells?.[col.key];

      const anchorRect = findCellRect(r, c);

      const move = (kind: "tab" | "enter", shift: boolean) => {
        const dir =
          kind === "tab"
            ? shift
              ? "left"
              : "right"
            : shift
            ? "up"
            : "down";
        const n = nextPosAfter(r, c, dir as any);
        setSel({ r1: n.r, r2: n.r, c1: n.c, c2: n.c });
      };

      const commit = (raw: string, opts?: { endEdit?: boolean }) => {
        commitCellValue(r, c, raw, { endEdit: !!opts?.endEdit });
      };

      const close = () => {
        // TableCore eier ikke picker-state, men vi kan hjelpe ved å avslutte edit om App ber om det.
        // App styrer faktisk om den vil endEdit eller ikke (via commit opts).
      };

      const req: TableCoreDatePickerRequest = {
        row: r,
        col: c,
        column: col,
        currentValue: current,
        anchorRect,
        mode,
        commit,
        move,
        close,
      };

      onRequestDatePicker(req);
    },
    [commitCellValue, onRequestDatePicker]
  );

  const onCellDoubleClick = (r: number, c: number) => (ev: React.MouseEvent) => {
    ev.preventDefault();
    suppressClickToEditOnce.current = true;

    const col = colsRef.current[c];
    if (isDateColumn(col) && onRequestDatePicker) {
      requestDatePicker(r, c, "view");
      return;
    }

    startEditing({ r, c, mode: "selectAll" });
  };

  const isAggregatedCell = (_rowIndex: number, _col: ColumnDef) => false;

  const displayValue = (
    rowIndex: number,
    col: ColumnDef,
    stored: CellValue
  ): CellValue => {
    // ✅ Preview fra App: vis valgt dato umiddelbart uten commit.
    if (
      isDateColumn(col) &&
      datePreview &&
      datePreview.row === rowIndex &&
      datePreview.col === (colsRef.current.findIndex((cc) => cc.key === col.key))
    ) {
      // NB: col-index mapping kan flytte ved drag/drop. Vi håndterer uansett i render-loop under,
      // så her bruker vi normal path og lar "effectiveVal" settes der.
    }

    if (isDateColumn(col) && typeof stored === "string") {
      const d = parseDateFlexible(stored, dateFormat);
      if (!d) return stored;
      if (col.type === "datetime") return formatDatetimeByPattern(d, dateFormat);
      return formatDateByPattern(d, dateFormat);
    }
    return stored;
  };

  const onCopy = (e: React.ClipboardEvent) => {
    const curSel = selRef.current;
    if (!hasSel(curSel)) return;
    const { c1, c2 } = curSel;

    const m: (string | number | "")[][] = [];

    for (const r of visibleRowIndices) {
      if (r < curSel.r1 || r > curSel.r2) continue;
      const row = data[r];
      const line: (string | number | "")[] = [];

      for (let c = c1; c <= c2; c++) {
        const col = cols[c];
        const stored = row.cells[col.key] ?? "";
        line.push(displayValue(r, col, stored) as any);
      }
      m.push(line);
    }

    if (m.length) {
      e.clipboardData.setData("text/plain", toTSV(m));
      e.preventDefault();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const curSel = selRef.current;
    if (!hasSel(curSel)) return;
    const txt = e.clipboardData.getData("text/plain");
    if (!txt) return;

    e.preventDefault();
    const m = parseClipboard(txt);

    const startIdxInVisible = visibleRowIndices.indexOf(curSel.r1);
    if (startIdxInVisible === -1) return;

    const next = dataRef.current.map((r) => ({ ...r, cells: { ...r.cells } }));

    for (let i = 0; i < m.length; i++) {
      const visRow = visibleRowIndices[startIdxInVisible + i];
      if (visRow === undefined) break;

      for (let j = 0; j < m[i].length; j++) {
        const cc = curSel.c1 + j;
        if (cc >= cols.length) break;
        const col = cols[cc];
        if (isAggregatedCell(visRow, col)) continue;

        const raw = m[i][j];

        if (isNumericColumn(col)) {
          next[visRow].cells[col.key] = raw === "" ? "" : Number(raw);
        } else if (isDateColumn(col)) {
          const d = parseDateFlexible(String(raw), dateFormat);
          if (col.type === "datetime")
            next[visRow].cells[col.key] = d
              ? formatDatetimeByPattern(d, dateFormat)
              : raw;
          else
            next[visRow].cells[col.key] = d
              ? formatDateByPattern(d, dateFormat)
              : raw;
        } else {
          next[visRow].cells[col.key] = raw as any;
        }
      }
    }

    setAndPropagate(next);
  };

  const isSingleCellSel = (s: Selection) =>
    hasSel(s) && s.r1 === s.r2 && s.c1 === s.c2;

  const gridCols = useMemo(() => makeGridTemplate(cols), [cols]);

  const headerInfo = headerInfoText ?? t("tableCore.headerInfoDemo");

  return (
    <div
      ref={rootRef}
      className="tc-root"
      style={rootStyleVars}
      onCopy={onCopy}
      onPaste={onPaste}
    >
      <div
        className="tc-wrap"
        style={wrapStyle}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
      >
        <div className="tc-header-stack">
          <div className="tc-header-info" style={{ gridTemplateColumns: gridCols }}>
            <div className="tc-cell tc-idx" />
            <div
              className="tc-cell tc-header-info-cell"
              style={{ gridColumn: "2 / -1" }}
            >
              <span className="tc-header-info-text">{headerInfo}</span>
            </div>
          </div>

          <div
            className="tc-header tc-header-cols"
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="tc-cell tc-idx">#</div>

            {cols.map((col, idx) => (
              <div
                key={col.key}
                className="tc-cell tc-header-cell"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/x-col-index", String(idx));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const fromStr = e.dataTransfer.getData("text/x-col-index");
                  if (fromStr === "") return;
                  const from = Number(fromStr);
                  if (Number.isNaN(from) || from === idx) return;

                  const next = colsRef.current.slice();
                  const [moved] = next.splice(from, 1);
                  next.splice(idx, 0, moved);
                  setCols(next);
                  onColumnsChange?.(next);

                  setSel((s) => {
                    if (!hasSel(s)) return s;

                    const mapIndex = (old: number) => {
                      const arr = colsRef.current.slice();
                      const [mv] = arr.splice(from, 1);
                      arr.splice(idx, 0, mv);
                      return arr.findIndex(
                        (c) => c.key === colsRef.current[old].key
                      );
                    };

                    return {
                      r1: s.r1,
                      r2: s.r2,
                      c1: mapIndex(s.c1),
                      c2: mapIndex(s.c2),
                    };
                  });
                }}
                title={t("tableCore.dragToMoveColumn")}
                style={{ fontWeight: "600" }}
              >
                <span className="tc-header-label">{col.title}</span>
                <span
                  className="tc-col-resizer"
                  onMouseDown={(e) => {
                    const col = colsRef.current[idx];
                    const headerEl = e.currentTarget.parentElement as
                      | HTMLDivElement
                      | null;
                    const guess = headerEl
                      ? headerEl.getBoundingClientRect().width
                      : undefined;
                    const startW = col.width ?? guess ?? 120;

                    const resizeRef = { idx, startX: e.clientX, startW };

                    const onMove = (ev: MouseEvent) => {
                      const dx = ev.clientX - resizeRef.startX;
                      const newW = clamp(Math.round(resizeRef.startW + dx), 60, 1000);

                      const next = colsRef.current.slice();
                      next[resizeRef.idx] = {
                        ...next[resizeRef.idx],
                        width: newW,
                      };
                      setCols(next);
                      onColumnsChange?.(next);
                    };

                    const onUp = () => {
                      document.removeEventListener("mousemove", onMove);
                    };

                    document.addEventListener("mousemove", onMove);
                    document.addEventListener("mouseup", onUp, { once: true });

                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  title={t("tableCore.dragToResizeColumn")}
                />
              </div>
            ))}
          </div>
        </div>

        {visibleRowIndices.map((rVisibleIdx, visiblePos) => {
          const row = data[rVisibleIdx];
          const showIndex = rowHasContent(row, cols);
          const isParent = hasChildren.has(rVisibleIdx);
          const isRowCollapsed = collapsed.has(row.id);

          const rowClasses = ["tc-row"];
          const isMilestone = !!(row as any).milestone;
          
          if (isParent) rowClasses.push("tc-parent");
          if (row.indent > 0) rowClasses.push("tc-child");
          if (isMilestone) rowClasses.push("tc-milestone");
          
          if (rowDropHint && rowDropHint.idx === rVisibleIdx) {
            rowClasses.push(rowDropHint.after ? "tc-drop-after" : "tc-drop-before");
          }

          return (
            <div
              key={row.id}
              className={rowClasses.join(" ")}
              style={{ gridTemplateColumns: gridCols }}
              data-r={rVisibleIdx}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
          
                setSel({ r1: rVisibleIdx, r2: rVisibleIdx, c1: 0, c2: 0 });
          
                onRowContextMenu?.({
                  row: rVisibleIdx,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
              onDragOver={(e) => {
                const draggingRow = dragRowIndexRef.current != null;

                const types = Array.from(e.dataTransfer.types || []);
                const hasType = types.includes("text/x-row-index");

                if (!draggingRow && !hasType) return;

                e.preventDefault();
                e.dataTransfer.dropEffect = "move";

                const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                const after = e.clientY > rect.top + rect.height / 2;
                setRowDropHint({ idx: rVisibleIdx, after });
              }}
              onDragLeave={() => {
                setRowDropHint((h) => (h?.idx === rVisibleIdx ? null : h));
              }}
              onDrop={(e) => {
                e.preventDefault();

                const fromStr = e.dataTransfer.getData("text/x-row-index");
                const from =
                  fromStr !== "" ? Number(fromStr) : (dragRowIndexRef.current ?? NaN);

                if (Number.isNaN(from)) return;

                const hint =
                  rowDropHint?.idx === rVisibleIdx
                    ? rowDropHint
                    : { idx: rVisibleIdx, after: true };

                const toBase = rVisibleIdx;
                let insertAt = hint.after ? toBase + 1 : toBase;

                const next = dataRef.current.slice();
                const [moved] = next.splice(from, 1);

                if (from < insertAt) insertAt -= 1;
                insertAt = Math.max(0, Math.min(next.length, insertAt));

                next.splice(insertAt, 0, moved);

                setRowDropHint(null);
                dragRowIndexRef.current = null;
                setAndPropagate(next);
              }}
            >
               <div
                  className="tc-cell tc-idx tc-row-handle"
                  draggable
                  title={t("tableCore.dragToMoveRow")}
                  onDragStart={(e) => {
                    dragRowIndexRef.current = rVisibleIdx;
  
                    e.dataTransfer.setData("text/x-row-index", String(rVisibleIdx));
                    e.dataTransfer.setData("text/plain", String(rVisibleIdx));
  
                    e.dataTransfer.effectAllowed = "move";
                    setRowDropHint(null);
                  }}
                  onDragEnd={() => {
                    dragRowIndexRef.current = null;
                    setRowDropHint(null);
                  }}
                >
                  {showIndex ? rVisibleIdx + 1 : ""}
                </div>

              {cols.map((col, cIdx) => {
                const curSel = sel;
                const inSel =
                  hasSel(curSel) &&
                  rVisibleIdx >= curSel.r1 &&
                  rVisibleIdx <= curSel.r2 &&
                  cIdx >= curSel.c1 &&
                  cIdx <= curSel.c2;

                const isThisSingleSelectedCell =
                  isSingleCellSel(curSel) &&
                  curSel.r1 === rVisibleIdx &&
                  curSel.c1 === cIdx;

                const classes = ["tc-cell"];
                if (inSel) classes.push("sel");

                const storedVal = row.cells[col.key] ?? "";

                // ✅ Preview fra App (viser valgt dato i cella umiddelbart, uten commit)
                const previewRaw =
                  datePreview &&
                  datePreview.row === rVisibleIdx &&
                  datePreview.col === cIdx
                    ? datePreview.raw
                    : null;

                const effectiveVal = (previewRaw ?? storedVal) as any;
                const shownVal = displayValue(rVisibleIdx, col, effectiveVal);

                const canEditThisCell = !isAggregatedCell(rVisibleIdx, col);
                const editingHere =
                  !!editing &&
                  editing.r === rVisibleIdx &&
                  editing.c === cIdx &&
                  canEditThisCell;

                if (editingHere) {
                  classes.push("editing");

                  if (isSelectColumn(col)) {
                    const options: string[] = ((col as any).options ?? []) as string[];

                    return (
                      <div
                        key={col.key}
                        className={classes.join(" ")}
                        data-cell
                        data-r={rVisibleIdx}
                        data-c={cIdx}
                      >
                        <select
                          className="tc-select"
                          autoFocus
                          value={String(editValue ?? "")}
                          onChange={(e) => {
                            const v = e.currentTarget.value;
                            setEditValueBoth(v);
                            commitEdit(rVisibleIdx, cIdx, v);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              e.preventDefault();
                              setEditingBoth(null);
                              return;
                            }
                            if (e.key === "Tab" || e.key === "Enter") {
                              e.preventDefault();
                              commitEdit(
                                rVisibleIdx,
                                cIdx,
                                String(editValueRef.current ?? "")
                              );
                              const next = nextPosAfter(
                                rVisibleIdx,
                                cIdx,
                                e.key === "Enter"
                                  ? e.shiftKey
                                    ? "up"
                                    : "down"
                                  : e.shiftKey
                                  ? "left"
                                  : "right"
                              );
                              setSel({
                                r1: next.r,
                                r2: next.r,
                                c1: next.c,
                                c2: next.c,
                              });
                            }
                          }}
                        >
                          <option value=""></option>
                          {options.map((name) => (
                            <option key={name} value={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  const showCalendar = isDateColumn(col);

                  if (showCalendar) {
                    return (
                      <div
                        key={col.key}
                        className={`${classes.join(" ")} tc-cell--has-datebtn`}
                        data-cell
                        data-r={rVisibleIdx}
                        data-c={cIdx}
                      >
                        <div className="tc-edit-wrap">
                          <textarea
                            ref={(el) => {
                              editorTextAreaRef.current = el;
                            }}
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValueBoth(e.currentTarget.value)}
                            onBlur={() => {
                              commitEdit(rVisibleIdx, cIdx, editValueRef.current);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Escape") {
                                e.preventDefault();
                                setEditingBoth(null);
                                return;
                              }
                              if (e.key === "Enter" || e.key === "Tab") {
                                e.preventDefault();
                                commitEdit(rVisibleIdx, cIdx, editValueRef.current);
                                const next = nextPosAfter(
                                  rVisibleIdx,
                                  cIdx,
                                  e.key === "Enter"
                                    ? e.shiftKey
                                      ? "up"
                                      : "down"
                                    : e.shiftKey
                                    ? "left"
                                    : "right"
                                );
                                setSel({
                                  r1: next.r,
                                  r2: next.r,
                                  c1: next.c,
                                  c2: next.c,
                                });
                              }
                            }}
                          />

                          <button
                            type="button"
                            className="tc-date-btn"
                            title={`${t("tableCore.chooseDate")} (${col.title})`}
                            aria-label={`${t("tableCore.chooseDateFor")} ${col.title}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              requestDatePicker(rVisibleIdx, cIdx, "edit");
                            }}
                          >
                            📅
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={col.key}
                      className={classes.join(" ")}
                      data-cell
                      data-r={rVisibleIdx}
                      data-c={cIdx}
                    >
                      <textarea
                        ref={(el) => {
                          editorTextAreaRef.current = el;
                        }}
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValueBoth(e.currentTarget.value)}
                        onBlur={() => {
                          commitEdit(rVisibleIdx, cIdx, editValueRef.current);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") {
                            e.preventDefault();
                            setEditingBoth(null);
                            return;
                          }
                          if (e.key === "Enter" || e.key === "Tab") {
                            e.preventDefault();
                            commitEdit(rVisibleIdx, cIdx, editValueRef.current);
                            const next = nextPosAfter(
                              rVisibleIdx,
                              cIdx,
                              e.key === "Enter"
                                ? e.shiftKey
                                  ? "up"
                                  : "down"
                                : e.shiftKey
                                ? "left"
                                : "right"
                            );
                            setSel({
                              r1: next.r,
                              r2: next.r,
                              c1: next.c,
                              c2: next.c,
                            });
                          }
                        }}
                      />
                    </div>
                  );
                }

                const showDateBtnInView =
                  isThisSingleSelectedCell &&
                  isDateColumn(col) &&
                  !isAggregatedCell(rVisibleIdx, col);

                const showDisclosure = !!(col as any).isTitle && isParent;

                return (
                  <div
                    key={col.key}
                    className={`${classes.join(" ")}${
                      showDateBtnInView ? " tc-cell--has-datebtn" : ""
                    }`}
                    data-cell
                    data-r={rVisibleIdx}
                    data-c={cIdx}
                    onMouseDown={onCellMouseDown(rVisibleIdx, cIdx)}
                    onDoubleClick={onCellDoubleClick(rVisibleIdx, cIdx)}
                    title={String(shownVal)}
                    style={showDateBtnInView ? { position: "relative" } : undefined}
                  >
                    <span
                      className={(col as any).isTitle ? "tc-title-text" : undefined}
                      style={
                        (col as any).isTitle
                          ? { paddingLeft: `${8 + (row.indent ?? 0) * 18}px` }
                          : undefined
                      }
                    >
                      {showDisclosure && (
                        <button
                          type="button"
                          className="tc-disc"
                          aria-label={
                            isRowCollapsed
                              ? t("tableCore.showSubRows")
                              : t("tableCore.hideSubRows")
                          }
                          title={
                            isRowCollapsed
                              ? t("tableCore.showSubRows")
                              : t("tableCore.hideSubRows")
                          }
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSel({
                              r1: rVisibleIdx,
                              r2: rVisibleIdx,
                              c1: cIdx,
                              c2: cIdx,
                            });
                          }}
                          onDoubleClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleCollapsed(row.id);
                            setSel({
                              r1: rVisibleIdx,
                              r2: rVisibleIdx,
                              c1: cIdx,
                              c2: cIdx,
                            });
                          }}
                        >
                          {isRowCollapsed ? "▸" : "▾"}
                        </button>
                      )}

                      <span>{String(shownVal)}</span>
                    </span>

                    {showDateBtnInView && (
                      <button
                        type="button"
                        className="tc-date-btn"
                        title={`${t("tableCore.chooseDate")} (${col.title})`}
                        aria-label={`${t("tableCore.chooseDateFor")} ${col.title}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          requestDatePicker(rVisibleIdx, cIdx, "view");
                        }}
                      >
                        📅
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
