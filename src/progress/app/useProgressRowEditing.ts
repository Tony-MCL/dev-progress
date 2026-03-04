// ===============================
// src/progress/app/useProgressRowEditing.ts
// ===============================
import { useEffect, useRef, useState } from "react";
import type { RowData } from "../../core/TableTypes";

import { recomputeAllRows } from "../autoSchedule";
import { startOfDay } from "../ganttDateUtils";
import { addWorkdays, formatDMY, parseDMYLoose } from "../ProgressCore";
import type { DurPopoverState, WeekendPopoverState } from "../AdjustPopovers";

type Args = {
  rows: RowData[];
  setRows: React.Dispatch<React.SetStateAction<RowData[]>>;
  progressCalendar: any;
};

export function useProgressRowEditing({ rows, setRows, progressCalendar }: Args) {
  // ============================
  // State + refs (popover flows)
  // ============================
  const [durPop, setDurPop] = useState<DurPopoverState | null>(null);
  const durPopRef = useRef<DurPopoverState | null>(null);
  useEffect(() => {
    durPopRef.current = durPop;
  }, [durPop]);

  const [weekendPop, setWeekendPop] = useState<WeekendPopoverState | null>(null);
  const weekendPopRef = useRef<WeekendPopoverState | null>(null);
  useEffect(() => {
    weekendPopRef.current = weekendPop;
  }, [weekendPop]);

  // Last known pointer position (for anchoring popovers)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 24, y: 24 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  // Trigger only if weekend is *closed* in the project calendar
  const isClosedWeekendDate = (d: Date) => {
    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;
    if (!isWeekend) return false;
    return !progressCalendar?.workWeekdays?.has?.(day);
  };

  // ============================
  // Table wiring
  // ============================
  const onRowsChange = (next: RowData[]) => {
    const freeze = durPopRef.current?.row ?? weekendPopRef.current?.row ?? null;
    const computed = recomputeAllRows(next, progressCalendar, freeze);
    setRows(computed);
  };

  const onCellCommit = (evt: any) => {
    if (!evt) return;

    // Weekend warning for start/end
    if (evt.columnKey === "start" || evt.columnKey === "end") {
      const rowIndex: number = evt.row;
      const r = rows[rowIndex];
      if (!r) return;

      const rawNext = evt.next;
      const parsed = parseDMYLoose(String(rawNext ?? ""));
      if (!parsed) return;

      if (isClosedWeekendDate(parsed)) {
        const p = lastPointerRef.current;
        setWeekendPop({
          row: rowIndex,
          columnKey: evt.columnKey,
          prevValue: evt.prev,
          rawNextValue: rawNext,
          parsedDate: parsed,
          x: p.x,
          y: p.y,
        });
        return;
      }
    }

    // Duration popover
    if (evt.columnKey !== "dur") return;

    const rowIndex: number = evt.row;
    const newDur = Number(evt.next);
    if (!Number.isFinite(newDur) || newDur <= 0) return;

    const r = rows[rowIndex];
    if (!r) return;

    const s = parseDMYLoose(String((r as any).cells.start ?? ""));
    const e = parseDMYLoose(String((r as any).cells.end ?? ""));
    if (!s || !e) return;

    const p = lastPointerRef.current;
    setDurPop({
      row: rowIndex,
      newDur: Math.round(newDur),
      x: p.x,
      y: p.y,
    });
  };

  // ============================
  // Weekend adjust actions
  // ============================
  const applyWeekendChoice = (choice: "prevWorkday" | "nextWorkday") => {
    const p = weekendPopRef.current;
    if (!p) return;

    const idx = p.row;
    const key = p.columnKey;

    const base = startOfDay(p.parsedDate);
    const adjusted =
      choice === "prevWorkday"
        ? addWorkdays(base, -1, progressCalendar)
        : addWorkdays(base, +1, progressCalendar);

    const next = rows.map((rr, i) =>
      i === idx ? { ...rr, cells: { ...(rr as any).cells } } : rr
    );

    (next[idx] as any).cells[key] = formatDMY(adjusted);

    const computed = recomputeAllRows(next, progressCalendar, null);
    setWeekendPop(null);
    setRows(computed);
  };

  const cancelWeekendAdjust = () => {
    const p = weekendPopRef.current;
    if (!p) {
      setWeekendPop(null);
      return;
    }

    const idx = p.row;
    const key = p.columnKey;

    const next = rows.map((rr, i) =>
      i === idx ? { ...rr, cells: { ...(rr as any).cells } } : rr
    );

    (next[idx] as any).cells[key] = p.prevValue ?? "";

    const computed = recomputeAllRows(next, progressCalendar, null);
    setWeekendPop(null);
    setRows(computed);
  };

  // ============================
  // Duration adjust actions
  // ============================
  const applyDurationChoice = (choice: "moveStart" | "moveEnd") => {
    const p = durPopRef.current;
    if (!p) return;

    const idx = p.row;
    const newDur = p.newDur;

    const cur = rows[idx] as any;
    if (!cur) {
      setDurPop(null);
      return;
    }

    const s = parseDMYLoose(String(cur?.cells?.start ?? ""));
    const e = parseDMYLoose(String(cur?.cells?.end ?? ""));
    if (!s || !e) {
      setDurPop(null);
      return;
    }

    const next = rows.map((rr, i) =>
      i === idx ? { ...rr, cells: { ...(rr as any).cells } } : rr
    ) as any[];

    if (choice === "moveEnd") {
      const newEnd = addWorkdays(s, newDur - 1, progressCalendar);
      next[idx].cells.end = formatDMY(newEnd);
      next[idx].cells.dur = newDur;
    } else {
      const newStart = addWorkdays(e, -(newDur - 1), progressCalendar);
      next[idx].cells.start = formatDMY(newStart);
      next[idx].cells.dur = newDur;
    }

    const computed = recomputeAllRows(next as any, progressCalendar, null);
    setDurPop(null);
    setRows(computed);
  };

  const closeDurationPopover = () => {
    setDurPop(null);
    setRows((prev) => recomputeAllRows(prev, progressCalendar, null));
  };

  return {
    durPop,
    weekendPop,
    onRowsChange,
    onCellCommit,
    applyWeekendChoice,
    cancelWeekendAdjust,
    applyDurationChoice,
    closeDurationPopover,
  };
}
