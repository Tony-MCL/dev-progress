// src/progress/ProgressCore.ts

import type { RowData } from "../core/TableTypes";

/**
 * ProgressCore (adapter/domain):
 * - Semantikk for Progress uten å lekke inn i TableCore.
 *
 * Regler (nå):
 * 1) Arbeidsdager: default man–fre (helg = ikke arbeidsdag)
 * 2) Varighet:
 *    A) Start + Slutt => Varighet = antall arbeidsdager inkl. begge ender
 *    B) Start + Varighet => Slutt = Start + (Varighet-1) arbeidsdager
 *    (Når alle tre finnes og bruker endrer varighet => App spør om vi flytter Start eller Slutt)
 * 3) Parent:
 *    - Parent får min start og max slutt fra descendants
 *    - Parent får varighet beregnet som andre rader
 */

export type ProgressCalendar = {
  /** JS: 0=Sun,1=Mon,...6=Sat */
  workWeekdays: Set<number>;

  /**
   * Ekstra fridager/ikke-arbeidsdager i ISO-format (YYYY-MM-DD).
   * Disse overstyrer workWeekdays (dvs. en vanlig hverdag kan gjøres "ikke-arbeidsdag").
   */
  nonWorkingDates?: Set<string>;
};

export const defaultCalendar: ProgressCalendar = {
  workWeekdays: new Set([1, 2, 3, 4, 5]),
};

export type ProgressKeys = {
  title: string;
  start: string;
  end: string;
  dur: string;
};

export type ComputeOptions = {
  /**
   * Når vi midlertidig ønsker å "fryse" en rad (typisk mens modal spør
   * om vi skal flytte start/slutt etter varighets-endring), så kan vi
   * hoppe over å auto-korrigere start/end/dur på akkurat den raden.
   */
  freezeRowIdx?: number | null;
};

function atMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toISODateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function isWorkday(d: Date, cal: ProgressCalendar): boolean {
  if (!cal.workWeekdays.has(d.getDay())) return false;
  const ex = cal.nonWorkingDates;
  if (!ex || ex.size === 0) return true;
  return !ex.has(toISODateKey(d));
}

export function addDays(d: Date, days: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

/**
 * addWorkdays:
 * - Adds N working days forward/backward.
 * - n>0 => forward, n<0 => backward.
 * - n=0 => same date (normalized to midnight).
 */
export function addWorkdays(start: Date, n: number, cal: ProgressCalendar): Date {
  let d = atMidnight(start);
  if (n === 0) return d;

  const step = n > 0 ? 1 : -1;
  let remaining = Math.abs(n);

  while (remaining > 0) {
    d = addDays(d, step);
    if (isWorkday(d, cal)) remaining--;
  }

  return d;
}

/**
 * workdaysInclusive:
 * Counts working days in [start..end], inclusive.
 * If start>end => 0.
 */
export function workdaysInclusive(start: Date, end: Date, cal: ProgressCalendar): number {
  const a = atMidnight(start);
  const b = atMidnight(end);
  if (+a > +b) return 0;

  let count = 0;
  let d = a;

  while (+d <= +b) {
    if (isWorkday(d, cal)) count++;
    d = addDays(d, 1);
  }

  return count;
}

/* =========================
   Dato: parsing + format
   ========================= */

export function formatDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/**
 * parseDMYLoose:
 * - Accepts "dd.mm.yyyy", "dd/mm/yyyy", "yyyy-mm-dd"
 * - Returns Date at midnight local, or null if invalid.
 */
export function parseDMYLoose(s: string): Date | null {
  const t = (s ?? "").trim();
  if (!t) return null;

  // yyyy-mm-dd
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const yyyy = Number(iso[1]);
    const mm = Number(iso[2]);
    const dd = Number(iso[3]);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
    return atMidnight(d);
  }

  // dd.mm.yyyy / dd/mm/yyyy
  const m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);

  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  return atMidnight(d);
}

/* =========================
   computeDerivedRows
   ========================= */

function hasValue(v: any): boolean {
  return v !== null && v !== undefined && String(v).trim().length > 0;
}

const PARENT_DERIVED_FLAG = "__progressParentDerived";

function cloneRow(r: RowData): RowData {
  const out = { ...r, cells: { ...r.cells } } as any;

  if ((r as any)?.[PARENT_DERIVED_FLAG]) {
    out[PARENT_DERIVED_FLAG] = true;
  }

  return out;
}

function isParentRowTitle(title: string): boolean {
  return String(title ?? "").trim().length > 0 && String(title).trim() === String(title).trim().toUpperCase();
}

export function computeDerivedRows(
  rows: RowData[],
  cal: ProgressCalendar,
  keys: ProgressKeys,
  opts?: ComputeOptions
): RowData[] {
  const freezeIdx = opts?.freezeRowIdx ?? null;

  const out = rows.map(cloneRow);

  // 1) Compute leaf rows: dur <-> start/end
  for (let i = 0; i < out.length; i++) {
    if (freezeIdx === i) continue;

    const r = out[i];
    const startRaw = r.cells[keys.start];
    const endRaw = r.cells[keys.end];
    const durRaw = r.cells[keys.dur];

    const hasStart = hasValue(startRaw);
    const hasEnd = hasValue(endRaw);
    const hasDur = hasValue(durRaw);

    const start = hasStart ? parseDMYLoose(String(startRaw)) : null;
    const end = hasEnd ? parseDMYLoose(String(endRaw)) : null;
    const dur = hasDur ? Number(String(durRaw).replace(",", ".")) : NaN;

    if (start && end) {
      const wd = workdaysInclusive(start, end, cal);
      if (wd > 0) r.cells[keys.dur] = wd;
      continue;
    }

    if (start && Number.isFinite(dur) && dur > 0) {
      const newEnd = addWorkdays(start, Math.round(dur) - 1, cal);
      r.cells[keys.end] = formatDMY(newEnd);
      r.cells[keys.dur] = Math.round(dur);
      continue;
    }

    if (end && Number.isFinite(dur) && dur > 0) {
      const newStart = addWorkdays(end, -(Math.round(dur) - 1), cal);
      r.cells[keys.start] = formatDMY(newStart);
      r.cells[keys.dur] = Math.round(dur);
      continue;
    }
  }

  // 2) Parent aggregation (min start / max end, then dur)
  //    Parent definition here is purely visual/hierarchy: indent rules.
  //    We treat any row that has children (next rows with higher indent) as parent.
  for (let i = out.length - 1; i >= 0; i--) {
    const r = out[i] as any;
    const indent = r.indent ?? 0;
    
    // Find children contiguous after i with higher indent until indent <= this indent.
    let j = i + 1;
    const hasChildren = j < out.length && (out[j].indent ?? 0) > indent;
    
    if (!hasChildren) {
      if (r[PARENT_DERIVED_FLAG]) {
        r.cells[keys.start] = "";
        r.cells[keys.end] = "";
        r.cells[keys.dur] = "";
        delete r[PARENT_DERIVED_FLAG];
      }
      continue;
    }

    let minStart: Date | null = null;
    let maxEnd: Date | null = null;

    while (j < out.length) {
      const rr = out[j];
      const ind = rr.indent ?? 0;
      if (ind <= indent) break;

      const s = parseDMYLoose(String(rr.cells[keys.start] ?? ""));
      const e = parseDMYLoose(String(rr.cells[keys.end] ?? ""));

      if (s) minStart = !minStart || s.getTime() < minStart.getTime() ? s : minStart;
      if (e) maxEnd = !maxEnd || e.getTime() > maxEnd.getTime() ? e : maxEnd;

      j++;
    }

    if (minStart && maxEnd) {
      r.cells[keys.start] = formatDMY(minStart);
      r.cells[keys.end] = formatDMY(maxEnd);
      const wd = workdaysInclusive(minStart, maxEnd, cal);
      if (wd > 0) {
        r.cells[keys.dur] = wd;
      } else {
        r.cells[keys.dur] = "";
      }
      r[PARENT_DERIVED_FLAG] = true;
    } else if (r[PARENT_DERIVED_FLAG]) {
      r.cells[keys.start] = "";
      r.cells[keys.end] = "";
      r.cells[keys.dur] = "";
      delete r[PARENT_DERIVED_FLAG];
    }
  }
  // 3) Optional: make parent rows “feel” like parents (purely display data)
  // (no-op here; styling is handled in TableCore CSS)

  return out;
}

// =========================================================
// Dependencies (dep / WBS)
// - Lives in ProgressCore (domain layer)
// - TableCore stays pure
// =========================================================

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export type DepType = "FS" | "SS" | "FF" | "SF";

export type DepEdge = {
  fromId: string; // predecessor activity id (from WBS or row id)
  toId: string; // successor activity id (row id)
  type: DepType;
  lagDays: number; // can be negative
  raw: string; // original token
};

export type DependencyIssue = {
  rowId: string; // the successor row
  token: string; // offending token
  code:
    | "UNKNOWN_PREDECESSOR"
    | "BAD_TOKEN"
    | "BAD_LAG"
    | "MISSING_SUCCESSOR_DATES"
    | "MISSING_PREDECESSOR_DATES";
  message: string;
};

export type DepLink = {
  fromRowId: string; // predecessor rowId
  toRowId: string; // successor rowId
  type: DepType;
  lagDays: number;
  valid: boolean; // true => can be satisfied based on dates
};

export type DepComputeResult = {
  edges: DepEdge[];
  links: DepLink[]; // render-ready links (rowId -> rowId)
  issues: DependencyIssue[];
};

// Parse tokens like:
//  1.2FS+3
//  3SS-1
//  4
// Default type: FS, default lag: 0
function parseDepToken(tokenRaw: string): { predId: string; type: DepType; lagDays: number } | null {
  const token = (tokenRaw ?? "").trim();
  if (!token) return null;

  // Accept id up to first relationship marker
  // Relationship: FS/SS/FF/SF (optional)
  // Lag: +n or -n (optional)
  const m = token.match(/^(.+?)(FS|SS|FF|SF)?([+-]\d+)?$/i);
  if (!m) return null;

  const predId = String(m[1] ?? "").trim();
  if (!predId) return null;

  const type = (String(m[2] ?? "FS").toUpperCase() as DepType) || "FS";

  const lagRaw = String(m[3] ?? "").trim();
  let lagDays = 0;
  if (lagRaw) {
    const n = Number(lagRaw);
    if (!Number.isFinite(n)) return null;
    lagDays = Math.trunc(n);
  }

  return { predId, type, lagDays };
}

// Evaluate whether successor dates satisfy dependency constraint
function isSatisfied(args: {
  predStart: Date;
  predEnd: Date;
  succStart: Date;
  succEnd: Date;
  type: DepType;
  lagDays: number;
  cal: ProgressCalendar;
}): boolean {
  const { predStart, predEnd, succStart, succEnd, type, lagDays, cal } = args;

  // lagDays interpreted as WORKDAYS in the same calendar
  const applyLag = (base: Date) => addWorkdays(base, lagDays, cal);

  const ps = startOfDay(predStart);
  const pe = startOfDay(predEnd);
  const ss = startOfDay(succStart);
  const se = startOfDay(succEnd);

  switch (type) {
    case "FS": {
      // Successor start >= predecessor end + lag
      const req = startOfDay(applyLag(pe));
      return +ss >= +req;
    }
    case "SS": {
      // Successor start >= predecessor start + lag
      const req = startOfDay(applyLag(ps));
      return +ss >= +req;
    }
    case "FF": {
      // Successor finish >= predecessor finish + lag
      const req = startOfDay(applyLag(pe));
      return +se >= +req;
    }
    case "SF": {
      // Successor finish >= predecessor start + lag
      const req = startOfDay(applyLag(ps));
      return +se >= +req;
    }
    default:
      return true;
  }
}

/**
 * Compute dependency edges/links/issues from rows.
 * - predecessor id is resolved by WBS (if present), otherwise row.id
 * - successor is always the current row
 */
export function computeDependencies(
  rows: Array<{ id: string; cells: Record<string, any> }>,
  cal: ProgressCalendar,
  keys: { wbsKey?: string; depKey: string; startKey: string; endKey: string }
): DepComputeResult {
  const wbsKey = keys.wbsKey ?? "wbs";
  const depKey = keys.depKey;
  const startKey = keys.startKey;
  const endKey = keys.endKey;

    // Build lookup: predecessorId -> rowId
  // Supports: WBS, row.id (r12), and visual row number ("1","2","3"...)
  const idToRowId = new Map<string, string>();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];

    const wbs = String(r.cells?.[wbsKey] ?? "").trim();
    if (wbs) idToRowId.set(wbs, r.id);

    idToRowId.set(String(r.id), r.id);

    // ✅ visual row number (1-based)
    idToRowId.set(String(i + 1), r.id);
  }

  // Cache dates
  const dateByRowId = new Map<string, { s: Date | null; e: Date | null }>();
  for (const r of rows) {
    const s = parseDMYLoose(String(r.cells?.[startKey] ?? ""));
    const e = parseDMYLoose(String(r.cells?.[endKey] ?? ""));
    dateByRowId.set(r.id, { s: s ? startOfDay(s) : null, e: e ? startOfDay(e) : null });
  }

  const edges: DepEdge[] = [];
  const links: DepLink[] = [];
  const issues: DependencyIssue[] = [];

  for (const r of rows) {
    const depRaw = String(r.cells?.[depKey] ?? "").trim();
    if (!depRaw) continue;

    const tokens = depRaw
      .split(/[;,]/g)
      .map((x) => x.trim())
      .filter(Boolean);

    for (const token of tokens) {
      const parsed = parseDepToken(token);
      if (!parsed) {
        issues.push({
          rowId: r.id,
          token,
          code: "BAD_TOKEN",
          message: `Ugyldig dependency-token: "${token}"`,
        });
        continue;
      }

      const predRowId = idToRowId.get(parsed.predId);
      if (!predRowId) {
        issues.push({
          rowId: r.id,
          token,
          code: "UNKNOWN_PREDECESSOR",
          message: `Fant ikke forgjenger: "${parsed.predId}"`,
        });
        continue;
      }

      edges.push({
        fromId: parsed.predId,
        toId: r.id,
        type: parsed.type,
        lagDays: parsed.lagDays,
        raw: token,
      });

      const predDates = dateByRowId.get(predRowId);
      const succDates = dateByRowId.get(r.id);

      if (!succDates?.s || !succDates?.e) {
        issues.push({
          rowId: r.id,
          token,
          code: "MISSING_SUCCESSOR_DATES",
          message: `Mangler start/slutt på aktivitet for å evaluere dependency.`,
        });
        links.push({
          fromRowId: predRowId,
          toRowId: r.id,
          type: parsed.type,
          lagDays: parsed.lagDays,
          valid: false,
        });
        continue;
      }

      if (!predDates?.s || !predDates?.e) {
        issues.push({
          rowId: r.id,
          token,
          code: "MISSING_PREDECESSOR_DATES",
          message: `Mangler start/slutt på forgjenger for å evaluere dependency.`,
        });
        links.push({
          fromRowId: predRowId,
          toRowId: r.id,
          type: parsed.type,
          lagDays: parsed.lagDays,
          valid: false,
        });
        continue;
      }

      const ok = isSatisfied({
        predStart: predDates.s,
        predEnd: predDates.e,
        succStart: succDates.s,
        succEnd: succDates.e,
        type: parsed.type,
        lagDays: parsed.lagDays,
        cal,
      });

      links.push({
        fromRowId: predRowId,
        toRowId: r.id,
        type: parsed.type,
        lagDays: parsed.lagDays,
        valid: ok,
      });
    }
  }

  return { edges, links, issues };
}

// =========================================================
// Dependency scheduling (forward-push)
// - Uses dep column to MOVE successor start/end to satisfy constraints
// - Workdays-aware and lag is interpreted as WORKDAYS
// - Parent aggregation should be run AFTER this (via computeDerivedRows)
// =========================================================

type DepSchedulingKeys = {
  wbsKey?: string;
  depKey: string;
  startKey: string;
  endKey: string;
  durKey: string;
};

function nextWorkdayOrSame(d: Date, cal: ProgressCalendar): Date {
  let x = atMidnight(d);
  while (!isWorkday(x, cal)) x = addDays(x, 1);
  return x;
}

// Returns a safe positive integer duration (workdays), or null if unknown
function readDurationWorkdays(r: RowData, durKey: string): number | null {
  const raw = r.cells?.[durKey];
  if (!hasValue(raw)) return null;

  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n)) return null;

  const d = Math.max(1, Math.round(n));
  return d;
}

function readStartEnd(r: RowData, startKey: string, endKey: string): { s: Date | null; e: Date | null } {
  const s = parseDMYLoose(String(r.cells?.[startKey] ?? ""));
  const e = parseDMYLoose(String(r.cells?.[endKey] ?? ""));
  return { s: s ? atMidnight(s) : null, e: e ? atMidnight(e) : null };
}

function setStartEndDur(
  r: RowData,
  startKey: string,
  endKey: string,
  durKey: string,
  s: Date,
  e: Date,
  dur: number
) {
  r.cells[startKey] = formatDMY(s);
  r.cells[endKey] = formatDMY(e);
  r.cells[durKey] = Math.max(1, Math.round(dur));
}

/**
 * applyDependencyScheduling:
 * Pushes successors forward (and if needed, increases duration) so that deps become satisfied.
 *
 * Rules:
 * - FS/SS constrain successor START (>= predEnd/predStart + lag)
 * - FF/SF constrain successor END   (>= predEnd/predStart + lag)
 * - Lag is in WORKDAYS
 * - If both a start-constraint and end-constraint exist and duration is too small,
 *   we EXTEND duration to make end meet the end-constraint.
 */
export function applyDependencyScheduling(
  rows: RowData[],
  cal: ProgressCalendar,
  keys: DepSchedulingKeys,
  opts?: { maxIterations?: number }
): RowData[] {
  const out = rows.map(cloneRow);

  const wbsKey = keys.wbsKey ?? "wbs";

    // predecessor-id (wbs / row.id / visual row number) -> row index
    const idToIdx = new Map<string, number>();
    for (let i = 0; i < out.length; i++) {
      const r = out[i];
      const wbs = String(r.cells?.[wbsKey] ?? "").trim();
      if (wbs) idToIdx.set(wbs, i);
  
      idToIdx.set(String(r.id), i);
  
      // ✅ visual row number (1-based)
      idToIdx.set(String(i + 1), i);
    }

  const maxIter = Math.max(5, opts?.maxIterations ?? 50);

  const parseTokens = (depRaw: string): Array<{ predId: string; type: DepType; lagDays: number }> => {
    return (depRaw ?? "")
      .trim()
      .split(/[;,]/g)
      .map((x) => x.trim())
      .filter(Boolean)
      .map((t) => parseDepToken(t))
      .filter(Boolean) as Array<{ predId: string; type: DepType; lagDays: number }>;
  };

  let changed = true;
  let iter = 0;

  while (changed && iter < maxIter) {
    iter++;
    changed = false;

    for (let i = 0; i < out.length; i++) {
      const r = out[i];

      const depRaw = String(r.cells?.[keys.depKey] ?? "").trim();
      if (!depRaw) continue;

      const tokens = parseTokens(depRaw);
      if (tokens.length === 0) continue;

      // Gather constraints
      let reqStart: Date | null = null;
      let reqEnd: Date | null = null;

      for (const t of tokens) {
        const predIdx = idToIdx.get(t.predId);
        if (predIdx === undefined) continue;

        const pred = out[predIdx];
        const pd = readStartEnd(pred, keys.startKey, keys.endKey);
        if (!pd.s || !pd.e) continue;

        const base =
          t.type === "SS" || t.type === "SF" ? atMidnight(pd.s) : atMidnight(pd.e);

        const withLag = addWorkdays(base, t.lagDays, cal);
        const normalized = nextWorkdayOrSame(withLag, cal);

        // FS/SS constrain START, FF/SF constrain END
        if (t.type === "FS" || t.type === "SS") {
          reqStart = !reqStart || +normalized > +reqStart ? normalized : reqStart;
        } else {
          reqEnd = !reqEnd || +normalized > +reqEnd ? normalized : reqEnd;
        }
      }

      if (!reqStart && !reqEnd) continue;

      // Read current successor values
      const curr = readStartEnd(r, keys.startKey, keys.endKey);
      const currDur = readDurationWorkdays(r, keys.durKey);

      // Determine a duration baseline
      let dur = currDur;
      if (!dur) {
        if (curr.s && curr.e) {
          const wd = workdaysInclusive(curr.s, curr.e, cal);
          dur = wd > 0 ? wd : 1;
        } else {
          dur = 1;
        }
      }

      // Compute new schedule (forward only)
      let newStart = curr.s ? atMidnight(curr.s) : null;
      let newEnd = curr.e ? atMidnight(curr.e) : null;

      // If we have a start-constraint, ensure start >= reqStart
      if (reqStart) {
        const baseStart = newStart ? newStart : reqStart;
        newStart = +baseStart < +reqStart ? reqStart : baseStart;
        newStart = nextWorkdayOrSame(newStart, cal);
        newEnd = addWorkdays(newStart, dur - 1, cal);
      } else if (newStart && !newEnd) {
        newEnd = addWorkdays(newStart, dur - 1, cal);
      }

      // If we have an end-constraint, ensure end >= reqEnd
      if (reqEnd) {
        const baseEnd = newEnd ? newEnd : reqEnd;
        newEnd = +baseEnd < +reqEnd ? reqEnd : baseEnd;
        newEnd = nextWorkdayOrSame(newEnd, cal);

        // If we already have a start, see if duration is enough; if not, extend.
        if (newStart) {
          const wd = workdaysInclusive(newStart, newEnd, cal);
          if (wd > dur) {
            dur = wd; // extend duration to reach required end
          } else {
            // duration is fixed; recompute end from start+dur-1, but must still satisfy reqEnd
            const recomputedEnd = addWorkdays(newStart, dur - 1, cal);
            if (+recomputedEnd < +newEnd) {
              // still not enough => extend to meet reqEnd
              dur = workdaysInclusive(newStart, newEnd, cal);
            } else {
              newEnd = recomputedEnd;
            }
          }
        } else {
          // We have end-constraint but no start => back-calc start from end and duration
          newStart = addWorkdays(newEnd, -(dur - 1), cal);
          newStart = nextWorkdayOrSame(newStart, cal);
          // ensure end matches the (possibly shifted) start/dur
          newEnd = addWorkdays(newStart, dur - 1, cal);

          // If that ended up < reqEnd because start normalization moved, extend dur to meet reqEnd
          if (+newEnd < +reqEnd) {
            newEnd = reqEnd;
            newEnd = nextWorkdayOrSame(newEnd, cal);
            dur = workdaysInclusive(newStart, newEnd, cal) || 1;
          }
        }
      }

      // Final normalization (must have both)
      if (!newStart && newEnd) {
        newStart = addWorkdays(newEnd, -(dur - 1), cal);
        newStart = nextWorkdayOrSame(newStart, cal);
        newEnd = addWorkdays(newStart, dur - 1, cal);
      }
      if (newStart && !newEnd) {
        newStart = nextWorkdayOrSame(newStart, cal);
        newEnd = addWorkdays(newStart, dur - 1, cal);
      }

      if (!newStart || !newEnd) continue;

      // Only write if something actually changes (date or dur)
      const prevS = curr.s ? +atMidnight(curr.s) : null;
      const prevE = curr.e ? +atMidnight(curr.e) : null;
      const prevDur = currDur ?? (curr.s && curr.e ? workdaysInclusive(curr.s, curr.e, cal) : null);

      const nowS = +newStart;
      const nowE = +newEnd;

      const durChanged = prevDur !== null && prevDur !== undefined ? Math.round(prevDur) !== Math.round(dur) : true;
      const startChanged = prevS === null ? true : prevS !== nowS;
      const endChanged = prevE === null ? true : prevE !== nowE;

      if (durChanged || startChanged || endChanged) {
        setStartEndDur(r, keys.startKey, keys.endKey, keys.durKey, newStart, newEnd, dur);
        changed = true;
      }
    }
  }

  return out;
}
