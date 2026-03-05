// src/progress/autoSchedule.ts
import type { RowData } from "../core/TableTypes";
import {
  computeDerivedRows,
  defaultCalendar,
  formatDMY,
  parseDMYLoose,
  addWorkdays,
} from "./ProgressCore";

// En stabil og ren implementasjon som:
// 1) computeDerivedRows først (dur fra start/end etc.)
// 2) bruker dep-feltet til å fylle inn manglende start/end + håndheve constraints
// 3) computeDerivedRows igjen for å konsolidere etter dependency-justering

type DepTypeLocal = "FS" | "SS" | "FF" | "SF";

function parseDepTokenLocal(tokenRaw: string): {
  predId: string;
  type: DepTypeLocal;
  lagDays: number;
} | null {
  const token = (tokenRaw ?? "").trim();
  if (!token) return null;

  // Supports: 6FS+1, 7ss-2, A105ff, etc (case-insensitive)
  const m = token.match(/^(.+?)(FS|SS|FF|SF)?([+-]\d+)?$/i);
  if (!m) return null;

  const predId = String(m[1] ?? "").trim();
  if (!predId) return null;

  const type =
    (String(m[2] ?? "FS").toUpperCase() as DepTypeLocal) || "FS";

  const lagRaw = String(m[3] ?? "").trim();
  let lagDays = 0;
  if (lagRaw) {
    const n = Number(lagRaw);
    if (!Number.isFinite(n)) return null;
    lagDays = Math.trunc(n);
  }

  return { predId, type, lagDays };
}

function startOfDayLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function applyDependencyAutoSchedule(
  baseRows: RowData[],
  calendar: typeof defaultCalendar,
  opts?: { freezeRowIdx?: number | null }
): RowData[] {
  const freezeIdx = opts?.freezeRowIdx ?? null;

  // Map predecessor identifiers -> row index
  // Supports:
  // - WBS value (cells.wbs)
  // - row.id (r1, r2, ...)
  // - visual row number ("1", "2", "3" ...)
  const keyToIndex = new Map<string, number>();
  for (let i = 0; i < baseRows.length; i++) {
    const r = baseRows[i];
    keyToIndex.set(String((r as any)?.id), i);

    const wbs = String((r as any)?.cells?.wbs ?? "").trim();
    if (wbs) keyToIndex.set(wbs, i);

    keyToIndex.set(String(i + 1), i);
  }

  // Clone on first change
  let out: RowData[] | null = null;
  const cloneIfNeeded = () => {
    if (out) return out;
    out = baseRows.map((rr) => ({ ...rr, cells: { ...(rr as any).cells } }));
    return out;
  };

  const addLagWorkdays = (d: Date, lagDays: number) =>
    startOfDayLocal(addWorkdays(d, lagDays, calendar));

  const pickConstraints = (depRaw: string): {
    minStart: Date | null;
    minEnd: Date | null;
  } => {
    const tokens = depRaw
      .split(/[;,]/g)
      .map((x) => x.trim())
      .filter(Boolean);

    // strictest constraint (max) across tokens
    let minStart: Date | null = null;
    let minEnd: Date | null = null;

    for (const token of tokens) {
      const parsed = parseDepTokenLocal(token);
      if (!parsed) continue;

      const predIdx = keyToIndex.get(parsed.predId);
      if (predIdx === undefined) continue;

      const predRow = baseRows[predIdx] as any;
      const ps = parseDMYLoose(String(predRow?.cells?.start ?? ""));
      const pe = parseDMYLoose(String(predRow?.cells?.end ?? ""));
      if (!ps || !pe) continue;

      const predStart = startOfDayLocal(ps);
      const predEnd = startOfDayLocal(pe);

      if (parsed.type === "FS") {
        const c = addLagWorkdays(predEnd, parsed.lagDays);
        if (!minStart || c > minStart) minStart = c;
        continue;
      }
      if (parsed.type === "SS") {
        const c = addLagWorkdays(predStart, parsed.lagDays);
        if (!minStart || c > minStart) minStart = c;
        continue;
      }
      if (parsed.type === "FF") {
        const c = addLagWorkdays(predEnd, parsed.lagDays);
        if (!minEnd || c > minEnd) minEnd = c;
        continue;
      }
      if (parsed.type === "SF") {
        const c = addLagWorkdays(predStart, parsed.lagDays);
        if (!minEnd || c > minEnd) minEnd = c;
        continue;
      }
    }

    return { minStart, minEnd };
  };

  for (let i = 0; i < baseRows.length; i++) {
    if (freezeIdx === i) continue;

    const r = baseRows[i] as any;
    const depRaw = String(r?.cells?.dep ?? "").trim();
    if (!depRaw) continue;

    const { minStart, minEnd } = pickConstraints(depRaw);
    if (!minStart && !minEnd) continue;

    const startStr = String(r?.cells?.start ?? "").trim();
    const endStr = String(r?.cells?.end ?? "").trim();

    const hasStart = startStr.length > 0;
    const hasEnd = endStr.length > 0;

    let didChange = false;

    // 1) fill missing start if constrained
    if (!hasStart && minStart) {
      const next = cloneIfNeeded();
      (next[i] as any).cells.start = formatDMY(minStart);
      didChange = true;
    }

    // 2) fill missing end if constrained
    if (!hasEnd && minEnd) {
      const next = cloneIfNeeded();
      (next[i] as any).cells.end = formatDMY(minEnd);
      didChange = true;
    }

    // 3) enforce constraints by moving only constrained side
    if (hasStart || hasEnd) {
      const parsedStart = hasStart ? parseDMYLoose(startStr) : null;
      const parsedEnd = hasEnd ? parseDMYLoose(endStr) : null;

      const curStart = parsedStart ? startOfDayLocal(parsedStart) : null;
      const curEnd = parsedEnd ? startOfDayLocal(parsedEnd) : null;

      if (minStart && curStart && curStart < minStart) {
        const next = cloneIfNeeded();
        (next[i] as any).cells.start = formatDMY(minStart);
        didChange = true;
      }

      if (minEnd && curEnd && curEnd < minEnd) {
        const next = cloneIfNeeded();
        (next[i] as any).cells.end = formatDMY(minEnd);
        didChange = true;
      }
    }
  }

  return out ?? baseRows;
}

export function recomputeAllRows(
  nextRows: RowData[],
  calendar: typeof defaultCalendar,
  freezeRowIdx?: number | null
) {
  const first = computeDerivedRows(
    nextRows,
    calendar,
    { title: "title", start: "start", end: "end", dur: "dur" },
    { freezeRowIdx: freezeRowIdx ?? null }
  );

  const withDeps = applyDependencyAutoSchedule(first, calendar, {
    freezeRowIdx,
  });

  return computeDerivedRows(withDeps, calendar, {
    title: "title",
    start: "start",
    end: "end",
    dur: "dur",
  });
}
