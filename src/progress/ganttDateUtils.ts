// src/progress/ganttDateUtils.ts
import type { RowData } from "../core/TableTypes";
import { parseDMYLoose } from "./ProgressCore";

export function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** ---- GANTT: samme tidslogikk som GanttView (for å kunne scrolle riktig) ---- */
export function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}

export function diffDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

export function getProjectSpanFromRows(rows: RowData[]) {
  let min: Date | null = null;
  let max: Date | null = null;

  for (const r of rows) {
    const s = parseDMYLoose(String((r as any)?.cells?.start ?? ""));
    const e = parseDMYLoose(String((r as any)?.cells?.end ?? ""));
    const sd = s ? startOfDay(s) : null;
    const ed = e ? startOfDay(e) : null;

    const cand = [sd, ed].filter(Boolean) as Date[];
    for (const d of cand) {
      if (!min || d < min) min = d;
      if (!max || d > max) max = d;
    }
  }

  return { min, max };
}

export function computeGanttMinForSpan(spanMin: Date | null) {
  const base = startOfDay(spanMin ?? new Date());
  return startOfDay(addMonths(base, -6));
}

export function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}
