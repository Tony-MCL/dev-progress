// ===============================
// src/progress/app/useProgressViewModel.ts
// ===============================
import { useMemo } from "react";
import type { ColumnDef, RowData } from "../../core/TableTypes";
import type { CalendarEntry } from "../CalendarModal";
import type { ProjectInfo } from "../ProjectModal";
import type { AppColumnDef } from "../tableCommands";

import { getVisibleColumns } from "../tableCommands";
import {
  computeDependencies,
  defaultCalendar,
  formatDMY,
} from "../ProgressCore";

type Args = {
  t: (key: string) => string;

  rows: RowData[];
  columns: ColumnDef[];
  appColumns: AppColumnDef[];

  projectInfo: ProjectInfo;
  calendarEntries: CalendarEntry[];
};

export function useProgressViewModel({
  t,
  rows,
  columns,
  appColumns,
  projectInfo,
  calendarEntries,
}: Args) {
  // owners => dropdown options
  const ownerOptions = useMemo(() => {
    const raw = (projectInfo as any)?.owners ?? [];
    if (!Array.isArray(raw)) return [];
    const names = raw
      .map((x: any) => {
        if (!x) return "";
        if (typeof x === "string") return x.trim();
        if (typeof x === "object") return String(x.name ?? "").trim();
        return "";
      })
      .filter(Boolean);

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const n of names) {
      if (seen.has(n)) continue;
      seen.add(n);
      unique.push(n);
    }
    return unique;
  }, [projectInfo]);

  // owner -> color map
  const ownerColorMap = useMemo(() => {
    const raw = (projectInfo as any)?.owners ?? [];
    const map: Record<string, string> = {};
    if (!Array.isArray(raw)) return map;

    for (const x of raw) {
      if (!x) continue;
      if (typeof x === "object") {
        const name = String((x as any).name ?? "").trim();
        const color = String((x as any).color ?? "").trim();
        if (name && color) map[name] = color;
      }
    }
    return map;
  }, [projectInfo]);

  const progressCalendar = useMemo(() => {
    const workWeekDays = (projectInfo as any)?.workWeekDays;
    const workWeekdays =
      workWeekDays === 7
        ? new Set<number>([0, 1, 2, 3, 4, 5, 6])
        : workWeekDays === 6
        ? new Set<number>([1, 2, 3, 4, 5, 6])
        : new Set<number>([1, 2, 3, 4, 5]);

    const nonWorking = new Set<string>();

    const addRange = (fromISO: string, toISO: string) => {
      if (!fromISO) return;
      const start = new Date(fromISO + "T00:00:00");
      const end = new Date(toISO + "T00:00:00");
      if (Number.isNaN(+start) || Number.isNaN(+end)) return;

      const a = +start <= +end ? start : end;
      const b = +start <= +end ? end : start;

      const toKey = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const dd = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${dd}`;
      };

      let d = new Date(a);
      while (+d <= +b) {
        nonWorking.add(toKey(d));
        d.setDate(d.getDate() + 1);
      }
    };

    for (const e of calendarEntries) {
      addRange(e.from, e.to || e.from);
    }

    return {
      ...defaultCalendar,
      workWeekdays,
      nonWorkingDates: nonWorking,
    };
  }, [calendarEntries, projectInfo]);

  const deps = useMemo(() => {
    return computeDependencies(rows, progressCalendar, {
      wbsKey: "wbs",
      depKey: "dep",
      startKey: "start",
      endKey: "end",
    });
  }, [rows, progressCalendar]);

  const visibleColumns = useMemo(() => getVisibleColumns(appColumns), [appColumns]);

  // owner -> select + options
  const visibleColumnsPatched = useMemo(() => {
    return visibleColumns.map((c) => {
      if (c.key !== "owner") return c;
      return {
        ...(c as any),
        type: "select",
        options: ownerOptions,
      } as any;
    });
  }, [visibleColumns, ownerOptions]);

  // Print: Gantt trenger start/end i columns-lista for å bygge barer,
  // selv om de er skjult i tabellen.
  const printColumnsPatched = useMemo(() => {
    const out = [...visibleColumnsPatched] as any[];
  
    const hasStart =
      out.some((c: any) => c?.key === "start") ||
      out.some((c: any) => c?.dateRole === "start");
    const hasEnd =
      out.some((c: any) => c?.key === "end") ||
      out.some((c: any) => c?.dateRole === "end");
    const hasOwner =
      out.some((c: any) => c?.key === "owner");
  
    // plukk original-definisjoner fra base columns
    const startDef = columns.find(
      (c: any) => c?.key === "start" || c?.dateRole === "start"
    );
    const endDef = columns.find(
      (c: any) => c?.key === "end" || c?.dateRole === "end"
    );
    const ownerDef = columns.find((c: any) => c?.key === "owner");
  
    if (!hasStart && startDef) out.push(startDef as any);
    if (!hasEnd && endDef) out.push(endDef as any);
  
    // Owner skal være tilgjengelig for print-farger selv om kolonnen er skjult i utskriftstabellen
    if (!hasOwner && ownerDef) {
      out.push({
        ...(ownerDef as any),
        visible: false,
        hidden: true,
        isVisible: false,
        show: false,
        type: "select",
        options: ownerOptions,
      });
    }
  
    return out;
  }, [visibleColumnsPatched, columns, ownerOptions]);

  const headerInfo = useMemo(() => {
    const p = (projectInfo.projectName ?? "").trim();
    const c = (projectInfo.customerName ?? "").trim();
    const no = (projectInfo.projectNo ?? "").trim();

    const baseISO = (projectInfo.baseStartISO ?? "").trim();
    let basePretty = "";
    if (baseISO) {
      const d = new Date(baseISO + "T00:00:00");
      if (!Number.isNaN(+d)) basePretty = formatDMY(d);
    }

    const parts: string[] = [];
    const projLeft = [no, p].filter(Boolean).join(" , ");

    if (projLeft) parts.push(`${t("app.header.project")}: ${projLeft}`);
    if (c) parts.push(`${t("app.header.customer")}: ${c}`);
    if (basePretty) parts.push(`${t("app.header.projectStart")}: ${basePretty}`);

    if (parts.length === 0) return t("app.header.fallback");
    return parts.join(" • ");
  }, [
    projectInfo.projectName,
    projectInfo.customerName,
    projectInfo.projectNo,
    projectInfo.baseStartISO,
    t,
  ]);

  return {
    ownerOptions,
    ownerColorMap,
    progressCalendar,
    deps,
    visibleColumns,
    visibleColumnsPatched,
    printColumnsPatched,
    headerInfo,
  };
}
