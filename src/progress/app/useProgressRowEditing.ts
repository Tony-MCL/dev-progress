// src/progress/app/useProgressRowEditing.ts
import { useCallback, useMemo, useState } from "react";
import type { RowData, ColumnDef, Selection } from "../../core/TableTypes";

import { recomputeAllRows } from "../autoSchedule";
import { defaultCalendar, parseDMYLoose, formatDMY, addWorkdays } from "../ProgressCore";
import type { WeekendPopoverState, DurPopoverState } from "../AdjustPopovers";

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function useProgressRowEditing(args: {
  rows: RowData[];
  setRows: (next: RowData[] | ((prev: RowData[]) => RowData[])) => void;

  columns: ColumnDef[];
  selection: Selection | null;

  progressCalendar: any; // same shape you already use
  freezeRowIdx: number | null; // pass null for now

  // Optional: used for "dirty" tracking / UI if you have it
  onAfterRowsCommit?: () => void;

  // i18n texts (strings) so hook stays UI-agnostic
  weekendPopoverTitle: string;
  weekendPrevText: string;
  weekendNextText: string;
  weekendCancelText: string;
}) {
  const {
    rows,
    setRows,
    columns,
    selection,
    progressCalendar,
    freezeRowIdx,
    onAfterRowsCommit,
    weekendPopoverTitle,
    weekendPrevText,
    weekendNextText,
    weekendCancelText,
  } = args;

  // -----------------------------
  // Weekend / Duration popovers
  // -----------------------------
  const [weekendPop, setWeekendPop] = useState<WeekendPopoverState | null>(null);
  const [durPop, setDurPop] = useState<DurPopoverState | null>(null);

  // helper: compute an actual calendar object
  const calendar = useMemo(() => {
    // progressCalendar in your app is already calendar-like.
    // We keep defaultCalendar as base to avoid missing fields.
    return { ...defaultCalendar, ...(progressCalendar as any) };
  }, [progressCalendar]);

  const commitRows = useCallback(
    (nextRows: RowData[], freezeIdx: number | null) => {
      const computed = recomputeAllRows(nextRows, calendar as any, freezeIdx ?? null);
      setRows(computed);
      onAfterRowsCommit?.();
    },
    [calendar, setRows, onAfterRowsCommit]
  );

  // -----------------------------
  // Public: TableCore onChange
  // -----------------------------
  const onRowsChange = useCallback(
    (nextRows: RowData[]) => {
      // Keep behavior: recompute derived rows
      commitRows(nextRows, freezeRowIdx);
    },
    [commitRows, freezeRowIdx]
  );

  // -----------------------------
  // Public: TableCore onCellCommit
  // -----------------------------
  const onCellCommit = useCallback(
    (rowIndex: number, columnKey: string, rawNextValue: any) => {
      // Only handle date fields with weekend rules here (start/end).
      // Everything else just commit as-is.
      if (columnKey !== "start" && columnKey !== "end") {
        const next = rows.map((r) => ({ ...r, cells: { ...(r as any).cells } })) as any[];
        next[rowIndex].cells[columnKey] = rawNextValue;
        commitRows(next as any, freezeRowIdx);
        return;
      }

      const parsed = parseDMYLoose(String(rawNextValue ?? ""));
      if (!parsed) {
        // allow clearing
        const next = rows.map((r) => ({ ...r, cells: { ...(r as any).cells } })) as any[];
        next[rowIndex].cells[columnKey] = String(rawNextValue ?? "");
        commitRows(next as any, freezeRowIdx);
        return;
      }

      const d = startOfDay(parsed);

      const day = d.getDay(); // 0 Sunday .. 6 Saturday
      const isWorkday =
        (calendar as any)?.workWeekdays?.has
          ? (calendar as any).workWeekdays.has(day)
          : day >= 1 && day <= 5;

      const iso =
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const isHoliday =
        (calendar as any)?.nonWorkingDates?.has
          ? (calendar as any).nonWorkingDates.has(iso)
          : false;

      if (!isWorkday || isHoliday) {
        // Open weekend popover: user must choose prev/next workday or cancel
        const prevValue = (rows as any[])[rowIndex]?.cells?.[columnKey];
        setWeekendPop({
          row: rowIndex,
          columnKey: columnKey as any,
          prevValue,
          rawNextValue,
          parsedDate: d,
          x: (window as any)?.__mcl_lastPointerX ?? window.innerWidth / 2,
          y: (window as any)?.__mcl_lastPointerY ?? window.innerHeight / 2,
        });
        return;
      }

      // If valid workday => commit directly formatted
      const next = rows.map((r) => ({ ...r, cells: { ...(r as any).cells } })) as any[];
      next[rowIndex].cells[columnKey] = formatDMY(d);
      commitRows(next as any, freezeRowIdx);
    },
    [rows, commitRows, freezeRowIdx, calendar]
  );

  // -----------------------------
  // Weekend popover actions
  // -----------------------------
  const applyWeekendChoice = useCallback(
    (choice: "prevWorkday" | "nextWorkday") => {
      const s = weekendPop;
      if (!s) return;

      const delta = choice === "prevWorkday" ? -1 : +1;
      const adjusted = addWorkdays(s.parsedDate, delta, calendar as any);

      const next = rows.map((r) => ({ ...r, cells: { ...(r as any).cells } })) as any[];
      next[s.row].cells[s.columnKey] = formatDMY(adjusted);

      setWeekendPop(null);
      commitRows(next as any, freezeRowIdx);
    },
    [weekendPop, rows, commitRows, freezeRowIdx, calendar]
  );

  const cancelWeekendAdjust = useCallback(() => {
    const s = weekendPop;
    if (!s) return;

    // restore previous value
    const next = rows.map((r) => ({ ...r, cells: { ...(r as any).cells } })) as any[];
    next[s.row].cells[s.columnKey] = s.prevValue ?? "";

    setWeekendPop(null);
    // no recompute on cancel? safest is recompute to keep consistency
    commitRows(next as any, freezeRowIdx);
  }, [weekendPop, rows, commitRows, freezeRowIdx]);

  // -----------------------------
  // Duration popover wiring (kept minimal)
  // NOTE: This hook only holds state + callbacks. You trigger setDurPop elsewhere
  // when you detect "duration conflict" — we move that detector next step if needed.
  // -----------------------------
  const onPickDurationAdjust = useCallback(
    (choice: "moveStart" | "moveEnd") => {
      const s = durPop;
      if (!s) return;

      // This action is domain-specific in your App.tsx currently.
      // We keep it as "close only" for now unless your App.tsx already had a specific logic.
      // If you already have the exact logic, we can move it in the next micro-step.
      setDurPop(null);
    },
    [durPop]
  );

  const closeDurationAdjust = useCallback(() => setDurPop(null), []);

  // i18n bundle for popover usage
  const weekendTexts = useMemo(
    () => ({
      titleText: weekendPopoverTitle,
      prevText: weekendPrevText,
      nextText: weekendNextText,
      cancelText: weekendCancelText,
    }),
    [weekendPopoverTitle, weekendPrevText, weekendNextText, weekendCancelText]
  );

  return {
    // TableCore handlers
    onRowsChange,
    onCellCommit,

    // weekend popover state + actions
    weekendPop,
    setWeekendPop,
    applyWeekendChoice,
    cancelWeekendAdjust,
    weekendTexts,

    // duration popover state + actions
    durPop,
    setDurPop,
    onPickDurationAdjust,
    closeDurationAdjust,

    // mostly for future steps (selection-aware edits)
    columns,
    selection,
  };
}
