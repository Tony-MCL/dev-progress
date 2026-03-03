// src/App.tsx

// ============================
// BLOCK: IMPORTS (START)
// ============================
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import TableCore from "./core/TableCore";
import type {
  ColumnDef,
  RowData,
  Selection,
  TableCoreDatePickerRequest,
  TableCoreDatePreview,
} from "./core/TableTypes";

import Header from "./components/Header";
import HelpPanel from "./components/HelpPanel";
import Toolbar from "./components/Toolbar";

import GanttView from "./progress/GanttView";
import ProgressToolbar from "./progress/ProgressToolbar";
import PrintPreviewOverlay from "./print2/PrintPreviewOverlay";
import ColumnManagerModal from "./progress/ColumnManagerModal";
import CalendarModal, { type CalendarEntry } from "./progress/CalendarModal";
import ProjectModal, { type ProjectInfo } from "./progress/ProjectModal";
import CloudProjectLibraryModal from "./progress/CloudProjectLibraryModal";
import ProjectLibraryModal from "./progress/ProjectLibraryModal";
import { useAuthUser } from "./auth/useAuthUser";
import { useOrgContext } from "./orgs/useOrgContext";
import { setOptimisticPlan } from "./orgs/optimisticPlan";
import { createIndexedDbProjectStore } from "./storage/indexedDbProjectStore";
import type { ProgressProjectSnapshotV1 } from "./storage/projectDbTypes";
import { saveProgressProjectToCloud } from "./cloud/cloudProjects";
import { PROGRESS_KEYS } from "./storage/progressLocalKeys";
import {
  lsReadString,
  lsWriteString,
  lsReadNumber,
  lsWriteNumber,
  lsReadBool,
  lsWriteBool,
} from "./storage/localSettings";

import {
  type AppColumnDef,
  getVisibleColumns,
  ensureAtLeastTitleVisible,
  applyColumnsToRows,
  addCustomColumn,
  addRowAtEnd,
  addRowBelowSelection,
  deleteSelectedRows,
} from "./progress/tableCommands";

import {
  computeDerivedRows,
  computeDependencies,
  defaultCalendar,
  formatDMY,
  parseDMYLoose,
  addWorkdays,
} from "./progress/ProgressCore";

import AppDatePickerPopover, {
  type DatePickerRequest,
} from "./progress/AppDatePickerPopover";

import { parseClipboard, toTSV } from "./core/utils/clipboard";
import { useI18n } from "./i18n";
import { LINKS } from "./config/links";

import "./styles/mcl-theme.css";
import "./styles/appshell.css";
import "./styles/header.css";
import "./styles/tablecore.css";
import "./styles/gantt.css";
import "./styles/progress-toolbar.css";
import "./styles/watermark.css";
// ============================
// BLOCK: IMPORTS (END)
// ============================

// ============================
// BLOCK: DATE_HELPERS (START)
// ============================
function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** ---- GANTT: samme tidslogikk som GanttView (for å kunne scrolle riktig) ---- */
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function addMonths(d: Date, months: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + months);
  return x;
}
function diffDays(a: Date, b: Date) {
  const ms = startOfDay(b).getTime() - startOfDay(a).getTime();
  return Math.round(ms / 86400000);
}

function getProjectSpanFromRows(rows: RowData[]) {
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

function computeGanttMinForSpan(spanMin: Date | null) {
  const base = startOfDay(spanMin ?? new Date());
  return startOfDay(addMonths(base, -6));
}
// ============================
// BLOCK: DATE_HELPERS (END)
// ============================

// ============================
// BLOCK: STORAGE_TSV_UTILS (START)
// ============================
function safeParseJSON<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function downloadTextFile(filename: string, mime: string, text: string) {
  const anyWin = window as any;
  const picker = anyWin?.showSaveFilePicker;

  const fallbackDownload = () => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  // If File System Access API is available (Chromium), use native "save as" dialog
  if (typeof picker === "function") {
    (async () => {
      try {
        const lower = String(filename || "").toLowerCase();
        const ext = lower.includes(".") ? "." + lower.split(".").pop() : "";

        // Base accept mapping (note: mime may include charset; we normalize a bit)
        const mimeBase = String(mime || "").split(";")[0].trim();

        let accept: Record<string, string[]> | undefined;

        if (ext === ".mclp" || mimeBase === "application/json") {
          accept = { "application/json": [".mclp", ".json"] };
        } else if (ext === ".tsv" || mimeBase === "text/tab-separated-values") {
          accept = { "text/tab-separated-values": [".tsv"] };
        } else if (ext === ".csv" || mimeBase === "text/csv") {
          accept = { "text/csv": [".csv"] };
        } else if (mimeBase.startsWith("text/")) {
          accept = { [mimeBase]: [ext || ".txt"] };
        }

        const handle = await anyWin.showSaveFilePicker({
          suggestedName: filename,
          types: accept
            ? [
                {
                  description: "File",
                  accept,
                },
              ]
            : undefined,
        });

        const writable = await handle.createWritable();
        await writable.write(text);
        await writable.close();
      } catch (e: any) {
        // ✅ User cancel => do nothing (NO fallback)
        const name = String(e?.name || "");
        if (name === "AbortError") return;

        // ✅ Real error => show message, no fallback
        console.warn("[Progress] Save dialog failed:", e);
        alert("Kunne ikke lagre filen. Prøv igjen.");
      }
    })();
    return;
  }

  // Non-Chromium browsers:
  // Her har vi ikke native picker. Du ba om at fallback er uønsket når bruker avbryter,
  // men uten picker finnes det ikke "avbryt"-case — kun download.
  // Hvis du heller vil blokkere helt her, kan vi gjøre det.
  fallbackDownload();
}

function pickTextFile(
  accept: string
): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;

    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        resolve({ name: file.name, text: String(reader.result ?? "") });
      };
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    };

    input.click();
  });
}
// ============================
// BLOCK: STORAGE_TSV_UTILS (END)
// ============================

// ============================
// BLOCK: HSCROLL_SYNC (START)
// ============================
function useBottomHScrollVar(opts: {
  hostEl: React.RefObject<HTMLDivElement>;
  measureEl: React.RefObject<HTMLDivElement>;
  barEl: React.RefObject<HTMLDivElement>;
  spacerEl: React.RefObject<HTMLDivElement>;
}) {
  const { hostEl, measureEl, barEl, spacerEl } = opts;

  useEffect(() => {
    const host = hostEl.current;
    const measure = measureEl.current;
    const bar = barEl.current;
    const spacer = spacerEl.current;
    if (!host || !measure || !bar || !spacer) return;

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

    const updateSpacerWidth = () => {
      const w = measure.scrollWidth;
      spacer.style.width = `${w}px`;

      const maxScroll = Math.max(0, w - bar.clientWidth);
      const next = clamp(bar.scrollLeft, 0, maxScroll);
      if (next !== bar.scrollLeft) bar.scrollLeft = next;

      host.style.setProperty("--x", String(next));
    };

    const onBarScroll = () => {
      host.style.setProperty("--x", String(bar.scrollLeft));
    };

    updateSpacerWidth();
    host.style.setProperty("--x", String(bar.scrollLeft));

    bar.addEventListener("scroll", onBarScroll, { passive: true });

    const ro = new ResizeObserver(() => updateSpacerWidth());
    ro.observe(measure);

    const onWin = () => updateSpacerWidth();
    window.addEventListener("resize", onWin);

    return () => {
      bar.removeEventListener("scroll", onBarScroll as any);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [hostEl, measureEl, barEl, spacerEl]);
}
// ============================
// BLOCK: HSCROLL_SYNC (END)
// ============================

// ============================
// BLOCK: SPLIT_HELPERS (START)
// ============================
function clamp01to100(n: number) {
  return Math.max(0, Math.min(100, n));
}
// ============================
// BLOCK: SPLIT_HELPERS (END)
// ============================

// ============================
// BLOCK: DEPENDENCY_AUTOSCHEDULE (START)
// ============================
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

    if (!didChange) {
      // no-op
    }
  }

  return out ?? baseRows;
}

function recomputeAllRows(
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
// ============================
// BLOCK: DEPENDENCY_AUTOSCHEDULE (END)
// ============================

// ============================
// BLOCK: DURATION_POPOVER (START)
// ============================
type DurPopoverState = { row: number; newDur: number; x: number; y: number };

function DurationAdjustPopover(props: {
  state: DurPopoverState | null;
  onPick: (choice: "moveStart" | "moveEnd") => void;
  onClose: () => void;
  titleText: string;
  moveStartText: string;
  moveEndText: string;
  keepEndMoveStartTitle: string;
  keepStartMoveEndTitle: string;
}) {
  const {
    state,
    onPick,
    onClose,
    titleText,
    moveStartText,
    moveEndText,
    keepEndMoveStartTitle,
    keepStartMoveEndTitle,
  } = props;

  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onDown = (e: MouseEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [state, onClose]);

  if (!state) return null;

  const PAD = 8;
  const estW = 220;
  const estH = 72;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = state.x + 10;
  let top = state.y + 10;

  if (left + estW > vw - PAD) left = Math.max(PAD, vw - PAD - estW);
  if (top + estH > vh - PAD) top = Math.max(PAD, vh - PAD - estH);

  return (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 99999,
        background: "white",
        border: "1px solid rgba(0,0,0,0.18)",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.1 }}>
        {titleText}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onPick("moveStart")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
          title={keepEndMoveStartTitle}
        >
          {moveStartText}
        </button>

        <button
          type="button"
          onClick={() => onPick("moveEnd")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
          title={keepStartMoveEndTitle}
        >
          {moveEndText}
        </button>
      </div>
    </div>
  );
}
// ============================
// BLOCK: DURATION_POPOVER (END)
// ============================

// ============================
// BLOCK: WEEKEND_POPOVER (START)
// ============================
type WeekendPopoverState = {
  row: number;
  columnKey: "start" | "end";
  prevValue: any;
  rawNextValue: any;
  parsedDate: Date;
  x: number;
  y: number;
};

function WeekendAdjustPopover(props: {
  state: WeekendPopoverState | null;
  onPick: (choice: "prevWorkday" | "nextWorkday") => void;
  onCancel: () => void;
  titleText: string;
  prevText: string;
  nextText: string;
  cancelText: string;
}) {
  const { state, onPick, onCancel, titleText, prevText, nextText, cancelText } =
    props;

  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    const onDown = (e: MouseEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onCancel();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [state, onCancel]);

  if (!state) return null;

  const PAD = 8;
  const estW = 260;
  const estH = 98;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = state.x + 10;
  let top = state.y + 10;

  if (left + estW > vw - PAD) left = Math.max(PAD, vw - PAD - estW);
  if (top + estH > vh - PAD) top = Math.max(PAD, vh - PAD - estH);

  return (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 99999,
        background: "white",
        border: "1px solid rgba(0,0,0,0.18)",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
        padding: "10px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        userSelect: "none",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.2 }}>
        {titleText}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onPick("prevWorkday")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {prevText}
        </button>

        <button
          type="button"
          onClick={() => onPick("nextWorkday")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {nextText}
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "white",
            color: "#111",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {cancelText}
        </button>
      </div>
    </div>
  );
}
// ============================
// BLOCK: WEEKEND_POPOVER (END)
// ============================

// ============================
// BLOCK: APP_COMPONENT (START)
// ============================
export default function App() {
  // ============================
  // AUTH + API BASE
  // ============================
  const auth = useAuthUser();
  
  // TS-guard: useAuthUser typing can end up as "never" in some builds.
  // Normalize uid/email safely without changing runtime behavior.
  const authUserObj = (auth as any)?.user as { uid?: string; email?: string } | null;
  const authUid = authUserObj?.uid ?? null;
  const authEmail = authUserObj?.email ?? null;
  
  const apiBase = useMemo(() => {
    const raw = String(import.meta.env.VITE_PROGRESS_API_BASE || "").trim();
    return raw ? raw.replace(/\/+$/g, "") : "";
  }, []);
  
  const org = useOrgContext(authUid, auth.getIdToken);

  // ============================
  // TRIAL: register wrapper (register -> trial/start -> optimistic -> refresh)
  // ============================
  const startTrialOnBackend = useCallback(
    async (token: string): Promise<any | null> => {
      if (!apiBase) return null;

      const url = `${apiBase}/trial/start`;

      const r = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ product: "progress" }),
      });

      // 409/400 kan være "already started" / "already has trial" osv.
      // Vi prøver likevel å lese JSON hvis den finnes.
      let data: any = null;
      try {
        data = await r.json();
      } catch {
        data = null;
      }

      if (r.ok) return data;

      if (r.status === 409 || r.status === 400) {
        // best effort – backend kan sende nyttig payload her også
        return data;
      }

      const msg = String(
        data?.error || data?.message || `trial_start_failed:${r.status}`
      );
      throw new Error(msg);
    },
    [apiBase]
  );

  const registerAndStartTrial = useCallback(
    async (email: string, password: string) => {
      // 1) register in Firebase Auth
      await auth.register(email, password);

      // 2) get token (force)
      const token = await auth.getIdToken(true);
      if (!token) throw new Error("No auth token after registration");

      // 3) start trial via Worker (writes to Firestore)
      const started = await startTrialOnBackend(token);

      // 4) optimistic UI (instant "trial" pill) — best effort
      const uidFromStart = String(started?.uid || authUid || "").trim();
      if (uidFromStart) setOptimisticPlan(uidFromStart, "trial");

      // 5) force refresh so verify picks it up and caches it
      await org.refresh({ force: true });

      return true;
    },
    [auth, authUid, org, startTrialOnBackend]
  );

  // ============================
  // BLOCK: AUTH_PLAN_AUTO_REFRESH (START)
  // ============================
  useEffect(() => {
    if (!auth.ready) return;
    if (!authUid) return;

    // Force refresh plan whenever user becomes available (login/register),
    // so the header pill updates without manual page refresh.
    void Promise.resolve(
      (org as any).refresh?.({ force: true }) ?? (org as any).refresh?.()
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.ready, authUid]);
  // ============================
  // BLOCK: AUTH_PLAN_AUTO_REFRESH (END)
  // ============================

  const { t } = useI18n();

  // fallback helper (dersom key mangler i språkfila)
  const tt = useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v === key ? fallback : v;
    },
    [t]
  );

  // ============================
  // BLOCK: COLUMNS (START)
  // ============================
  const columns: ColumnDef[] = useMemo(
    () => [
      { key: "title", title: t("app.columns.activity"), isTitle: true },
      {
        key: "start",
        title: t("app.columns.start"),
        type: "date",
        dateRole: "start",
        width: 140,
      },
      {
        key: "end",
        title: t("app.columns.end"),
        type: "date",
        dateRole: "end",
        width: 140,
      },
      {
        key: "dur",
        title: t("app.columns.duration"),
        type: "number",
        width: 110,
      },
      { key: "dep", title: t("app.columns.dependency"), width: 140 },
      { key: "wbs", title: t("app.columns.wbs"), width: 110 },
      { key: "owner", title: t("app.columns.owner"), width: 140 },
      { key: "note", title: t("app.columns.comment"), width: 220 },
    ],
    [t]
  );
  // ============================
  // BLOCK: COLUMNS (END)
  // ============================

  // ============================
  // BLOCK: ROW_BUILDERS (START)
  // ============================

  function buildBlankRows(count: number): RowData[] {
    const rows: RowData[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        id: `r${i + 1}`,
        indent: 0,
        cells: {
          title: "",
          start: "",
          end: "",
          dur: "",
          dep: "",
          wbs: "",
          owner: "",
          note: "",
        },
      });
    }

    return computeDerivedRows(rows, defaultCalendar, {
      title: "title",
      start: "start",
      end: "end",
      dur: "dur",
    });
  }
  // ============================
  // BLOCK: ROW_BUILDERS (END)
  // ============================

  // ============================
  // BLOCK: APP_STATE (START)
  // ============================
  const [rows, setRows] = useState<RowData[]>(() => buildBlankRows(120));
  const [selection, setSelection] = useState<Selection | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [print2Open, setPrint2Open] = useState(false);

  // CALENDAR
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>([]);

  // PROJECT
  const [projectOpen, setProjectOpen] = useState(false);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>({
    projectName: "",
    customerName: "",
    projectNo: "",
    baseStartISO: new Date().toISOString().slice(0, 10),
    workWeekDays: 5,
    notes: "",
    owners: [],
  });

  // PROJECT STORE (CLEAN RESET): local IndexedDB only (ingen auth/db/org/worker)
  const projectStore = useMemo(() => createIndexedDbProjectStore(), []);

  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);

  const [currentProjectId, setCurrentProjectId] = useState<string | null>(() => {
    return lsReadString(PROGRESS_KEYS.currentProjectId, null);
  });
  const [currentCloudProjectId, setCurrentCloudProjectId] = useState<string | null>(() => {
    return lsReadString("progress_currentCloudProjectId", null);
  });

  // Paid = kun rendering (watermark etc). Worker avgjør plan.
  const isPaid = org.activePlan === "pro";

  useEffect(() => {
    lsWriteString(PROGRESS_KEYS.currentProjectId, currentProjectId);
  }, [currentProjectId]);

  useEffect(() => {
    lsWriteString("progress_currentCloudProjectId", currentCloudProjectId);
  }, [currentCloudProjectId]);

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

  // GANTT view options (13 zoom trinn, styrt kun av pxPerDay. nivå 11: default/reset zoom)
  const ganttZoomLevels = [3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 32, 40] as const;

  const [ganttZoomIdx, setGanttZoomIdx] = useState<number>(() => {
    return Math.floor(
      lsReadNumber(PROGRESS_KEYS.ganttZoomIdx, 11, {
        min: 0,
        max: ganttZoomLevels.length - 1,
      })
    );
  });

  const [ganttWeekendShade, setGanttWeekendShade] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttWeekendShade, true);
  });
  const [ganttTodayLine, setGanttTodayLine] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttTodayLine, true);
  });

  useEffect(() => {
    lsWriteNumber(PROGRESS_KEYS.ganttZoomIdx, ganttZoomIdx);
  }, [ganttZoomIdx]);
  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttWeekendShade, ganttWeekendShade);
  }, [ganttWeekendShade]);
  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttTodayLine, ganttTodayLine);
  }, [ganttTodayLine]);

  const [ganttShowBarText, setGanttShowBarText] = useState<boolean>(() => {
    return lsReadBool(PROGRESS_KEYS.ganttShowBarText, true);
  });

  const [ganttDefaultBarColor, setGanttDefaultBarColor] = useState<string>(() => {
    return lsReadString(PROGRESS_KEYS.ganttDefaultBarColor, "#b98a3a") || "#b98a3a";
  });

  useEffect(() => {
    lsWriteBool(PROGRESS_KEYS.ganttShowBarText, ganttShowBarText);
  }, [ganttShowBarText]);

  useEffect(() => {
    lsWriteString(PROGRESS_KEYS.ganttDefaultBarColor, ganttDefaultBarColor);
  }, [ganttDefaultBarColor]);
  
  const ganttPxPerDay = ganttZoomLevels[ganttZoomIdx] ?? 24;

  const [visibleRowIds, setVisibleRowIds] = useState<string[] | undefined>(
    undefined
  );

  const [appColumns, setAppColumns] = useState<AppColumnDef[]>(
    columns.map((c) => ({ ...c, visible: true, custom: false }))
  );

  // i18n patch for base columns
  useEffect(() => {
    setAppColumns((prev) => {
      const byKey = new Map(columns.map((c) => [c.key, c]));
      return prev.map((c: any) => {
        const base = byKey.get(c.key);
        if (!base) return c;
        return { ...c, title: base.title };
      });
    });
  }, [columns]);

  const [colMgrOpen, setColMgrOpen] = useState(false);

  const visibleColumns = useMemo(
    () => getVisibleColumns(appColumns),
    [appColumns]
  );

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

    // plukk original-definisjoner (med dateRole) fra base columns
    const startDef = columns.find(
      (c: any) => c?.key === "start" || c?.dateRole === "start"
    );
    const endDef = columns.find(
      (c: any) => c?.key === "end" || c?.dateRole === "end"
    );

    if (!hasStart && startDef) out.push(startDef as any);
    if (!hasEnd && endDef) out.push(endDef as any);

    return out;
  }, [visibleColumnsPatched, columns]);

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
    if (basePretty)
      parts.push(`${t("app.header.projectStart")}: ${basePretty}`);

    if (parts.length === 0) return t("app.header.fallback");
    return parts.join(" • ");
  }, [
    projectInfo.projectName,
    projectInfo.customerName,
    projectInfo.projectNo,
    projectInfo.baseStartISO,
    t,
  ]);

  const watermarkUrl = `${import.meta.env.BASE_URL}mcl-watermark.svg`;

  const tableHostRef = useRef<HTMLDivElement | null>(null);
  const tableMeasureRef = useRef<HTMLDivElement | null>(null);
  const tableBarRef = useRef<HTMLDivElement | null>(null);
  const tableSpacerRef = useRef<HTMLDivElement | null>(null);

  const ganttHostRef = useRef<HTMLDivElement | null>(null);
  const ganttMeasureRef = useRef<HTMLDivElement | null>(null);
  const ganttBarRef = useRef<HTMLDivElement | null>(null);
  const ganttSpacerRef = useRef<HTMLDivElement | null>(null);
  // ============================
  // BLOCK: APP_STATE (END)
  // ============================

  // recompute when calendar changes
  useEffect(() => {
    setRows((prev) => recomputeAllRows(prev, progressCalendar, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressCalendar]);

  // scroll sync vars
  useBottomHScrollVar({
    hostEl: tableHostRef,
    measureEl: tableMeasureRef,
    barEl: tableBarRef,
    spacerEl: tableSpacerRef,
  });

  useBottomHScrollVar({
    hostEl: ganttHostRef,
    measureEl: ganttMeasureRef,
    barEl: ganttBarRef,
    spacerEl: ganttSpacerRef,
  });

  // ============================
  // BLOCK: SPLIT_STATE_HANDLERS (START)
  // ============================
  const splitGridRef = useRef<HTMLDivElement | null>(null);
  const [splitLeft, setSplitLeft] = useState<number>(() => {
    return clamp01to100(lsReadNumber(PROGRESS_KEYS.splitLeft, 50));
  });

  useEffect(() => {
    lsWriteNumber(PROGRESS_KEYS.splitLeft, splitLeft);
  }, [splitLeft]);

  const setFromClientX = (clientX: number) => {
    const grid = splitGridRef.current;
    if (!grid) return;
    const r = grid.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const x = clientX - r.left;
    const pct = (x / w) * 100;
    setSplitLeft(clamp01to100(pct));
  };

  const onDividerPointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
    setFromClientX(e.clientX);

    const onMove = (ev: PointerEvent) => setFromClientX(ev.clientX);
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const onDividerKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const step = e.shiftKey ? 5 : 1;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSplitLeft((v) => clamp01to100(v - step));
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      setSplitLeft((v) => clamp01to100(v + step));
    }
    if (e.key === "Home") {
      e.preventDefault();
      setSplitLeft(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      setSplitLeft(100);
    }
  };
  // ============================
  // BLOCK: SPLIT_STATE_HANDLERS (END)
  // ============================

  // ============================
  // BLOCK: DURATION + WEEKEND FLOW (START)
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

  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 24, y: 24 });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      lastPointerRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);

  const isClosedWeekendDate = (d: Date) => {
    const day = d.getDay();
    const isWeekend = day === 0 || day === 6;
    if (!isWeekend) return false;

    // Trigger kun hvis denne helgedagen faktisk er stengt i prosjektets kalender
    return !progressCalendar.workWeekdays.has(day);
  };

  const onRowsChange = (next: RowData[]) => {
    const freeze = durPopRef.current?.row ?? weekendPopRef.current?.row ?? null;
    const computed = recomputeAllRows(next, progressCalendar, freeze);
    setRows(computed);
  };

  const onCellCommit = (evt: any) => {
    if (!evt) return;

    // weekend warning for start/end
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

    // duration popover
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
  // ============================
  // BLOCK: DURATION + WEEKEND FLOW (END)
  // ============================
  // ============================
  // BLOCK: DATEPICKER_POPOVER (START)
  // ============================
  const [datePickReq, setDatePickReq] = useState<TableCoreDatePickerRequest | null>(null);
  const datePickReqRef = useRef<TableCoreDatePickerRequest | null>(null);
  useEffect(() => {
    datePickReqRef.current = datePickReq;
  }, [datePickReq]);

  const closeDatePickerUI = useCallback(() => {
    setDatePickReq(null);
  }, []);
  // TableCore -> App: åpne datepicker som popover (App eier UI)
  const onRequestDatePicker = useCallback((req: TableCoreDatePickerRequest) => {
    setDatePickReq(req);
  }, []);
  // ============================
  // BLOCK: DATEPICKER_POPOVER (END)
  // ============================

  
  // ============================
  // BLOCK: PROJECT_DB_SNAPSHOT (START)
  // ============================
    const fallbackCloudTitle = (snapTitle: string) => {
    const clean = String(snapTitle || "").trim();
    if (clean && clean !== "Untitled project") return clean;

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");

    // enkel, robust fallback (i18n tar vi i Steg I)
    return `Prosjekt ${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const buildProjectTitle = () => {
    const p = String(projectInfo?.projectName ?? "").trim();
    const c = String(projectInfo?.customerName ?? "").trim();
    const no = String(projectInfo?.projectNo ?? "").trim();

    const left = [no, p].filter(Boolean).join(" , ");
    const title = [left, c].filter(Boolean).join(" • ");

    return title || "Untitled project";
  };

  const buildSnapshot = (): ProgressProjectSnapshotV1 => {
    return {
      v: 1,
      title: buildProjectTitle(),
      rows,
      appColumns,
      projectInfo,
      calendarEntries,
      ui: {
        splitLeft,
        ganttZoomIdx,
        ganttWeekendShade,
        ganttTodayLine,
      
        ganttShowBarText,
        ganttDefaultBarColor,
      },
    };
  };

  const applySnapshot = (snap: ProgressProjectSnapshotV1) => {
    // Safety: tolerate missing fields
    const nextAppCols = Array.isArray((snap as any)?.appColumns)
      ? (snap as any).appColumns
      : appColumns;
    const nextRows = Array.isArray((snap as any)?.rows)
      ? (snap as any).rows
      : rows;

        const nextProjectInfo = ((snap as any)?.projectInfo ?? projectInfo) as ProjectInfo;
        const nextCalendarEntries = ((snap as any)?.calendarEntries ?? []) as CalendarEntry[];
    
        // Bygg korrekt kalender synkront for dette prosjektet (viktig ved prosjektbytte)
        const workWeekDays = (nextProjectInfo as any)?.workWeekDays;
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
    
        for (const e of nextCalendarEntries) {
          addRange(e.from, (e as any).to || e.from);
        }
    
        const cal = {
          ...defaultCalendar,
          workWeekdays,
          nonWorkingDates: nonWorking,
        };
    
        setAppColumns(ensureAtLeastTitleVisible(nextAppCols));
        setProjectInfo(nextProjectInfo);
        setCalendarEntries(nextCalendarEntries);
        setRows(recomputeAllRows(nextRows, cal, null));

    // UI prefs
    const ui = (snap as any)?.ui ?? {};
    if (typeof ui.splitLeft === "number") setSplitLeft(clamp01to100(ui.splitLeft));
    if (typeof ui.ganttZoomIdx === "number") setGanttZoomIdx(ui.ganttZoomIdx);
    if (typeof ui.ganttWeekendShade === "boolean") setGanttWeekendShade(ui.ganttWeekendShade);
    if (typeof ui.ganttTodayLine === "boolean") setGanttTodayLine(ui.ganttTodayLine);
    if (typeof ui.ganttShowBarText === "boolean") setGanttShowBarText(ui.ganttShowBarText);
    if (typeof ui.ganttDefaultBarColor === "string") setGanttDefaultBarColor(ui.ganttDefaultBarColor);

    requestGanttFocus();
  };
  // ============================
  // BLOCK: PROJECT_DB_SNAPSHOT (END)
  // ============================

    const saveToCloudProOnly = useCallback(async () => {
      const plan = String(org.activePlan ?? "free");
      const isProOrTrial = plan === "pro" || plan === "trial";
      if (!isProOrTrial) return;
    
      if (!apiBase) {
        console.warn("[Progress][Cloud] Missing apiBase (VITE_PROGRESS_API_BASE)");
        return;
      }
    
      if (!authUid) {
        console.warn("[Progress][Cloud] No auth user");
        return;
      }
      if (!org.activeOrgId) {
        console.warn("[Progress][Cloud] No active orgId");
        return;
      }
    
      try {
        const token = await auth.getIdToken(false);
        if (!token) {
          console.warn("[Progress][Cloud] Missing auth token");
          return;
        }
    
        const snap = buildSnapshot();
    
        const res = await saveProgressProjectToCloud({
          apiBase,
          token,
          orgId: org.activeOrgId,
          uid: authUid,
          title: fallbackCloudTitle(snap.title),
          snapshot: snap,
          projectId: currentCloudProjectId,
        });
    
        setCurrentCloudProjectId(res.id);
        console.log("[Progress][Cloud] Saved:", res.id);
      } catch (e) {
        console.warn("[Progress][Cloud] Save failed:", e);
      }
    }, [
      org.activePlan,
      org.activeOrgId,
      authUid,
      apiBase,
      auth,
      currentCloudProjectId,
      rows,
      appColumns,
      projectInfo,
      calendarEntries,
      splitLeft,
      ganttZoomIdx,
      ganttWeekendShade,
      ganttTodayLine,
      ganttShowBarText,
      ganttDefaultBarColor,
    ]);

  // ============================
  // BLOCK: TSV_EXPORT (START)
  // ============================
  const exportTSV = () => {
    const used = rows.filter(
      (r) => String((r as any)?.cells?.title ?? "").trim().length > 0
    );

    const header = ["Indent", ...columns.map((c) => c.key)];
    const matrix: (string | number | "")[][] = [header];

    for (const r of used) {
      const line: (string | number | "")[] = [];
      line.push((r as any).indent ?? 0);
      for (const c of columns) {
        const v = (r as any).cells?.[c.key];
        line.push(v === null || v === undefined ? "" : (v as any));
      }
      matrix.push(line);
    }

    const text = toTSV(matrix);
    const stamp = new Date();
    const y = stamp.getFullYear();
    const m = String(stamp.getMonth() + 1).padStart(2, "0");
    const d = String(stamp.getDate()).padStart(2, "0");
    downloadTextFile(
      `progress-plan-${y}${m}${d}.tsv`,
      "text/tab-separated-values",
      text
    );
  };
  // ============================
  // BLOCK: TSV_EXPORT (END)
  // ============================

  // ============================
  // BLOCK: GANTT_FOCUS (START)
  // ============================
  const ganttFocusTokenRef = useRef(0);
  const [ganttFocusToken, setGanttFocusToken] = useState(0);

  const requestGanttFocus = () => {
    ganttFocusTokenRef.current++;
    setGanttFocusToken(ganttFocusTokenRef.current);
  };
  
  // ============================
  // BLOCK: NEW_PROJECT_IN_NEW_TAB (START)
  // ============================
  const openNewProjectInNewTab = useCallback(() => {
    const u = new URL(window.location.href);
    u.searchParams.set("new", "1");
    u.searchParams.set("_t", String(Date.now()));
    window.open(u.toString(), "_blank", "noopener,noreferrer");
  }, []);
  
  const didHandleNewTabRef = useRef(false);
  
  useEffect(() => {
    if (didHandleNewTabRef.current) return;
    didHandleNewTabRef.current = true;
  
    const sp = new URLSearchParams(window.location.search);
    const isNew = sp.get("new") === "1";
    if (!isNew) return;
  
    sp.delete("new");
    sp.delete("_t");
  
    const nextQs = sp.toString();
    const nextUrl =
      window.location.pathname +
      (nextQs ? `?${nextQs}` : "") +
      window.location.hash;
  
    window.history.replaceState(null, "", nextUrl);
  
    setCurrentProjectId(null);
    setCurrentCloudProjectId(null);
    requestGanttFocus();
    setRows(buildBlankRows(120));
    setProjectOpen(true);
    setSelection(null);

    setProjectInfo({
      projectName: "",
      customerName: "",
      projectNo: "",
      baseStartISO: new Date().toISOString().slice(0, 10),
      workWeekDays: 5,
      notes: "",
      owners: [],
    });

    setCalendarEntries([]);
    setAppColumns(columns.map((c) => ({ ...c, visible: true, custom: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // ============================
  // BLOCK: NEW_PROJECT_IN_NEW_TAB (END)
  // ============================

  const focusGanttToProjectStartOrToday = (rowsSnapshot: RowData[]) => {
    const bar = ganttBarRef.current;
    const measure = ganttMeasureRef.current;
    if (!bar || !measure) return;

    const pxPerDay = ganttPxPerDay;
    const { min } = getProjectSpanFromRows(rowsSnapshot);

    const today = startOfDay(new Date());
    const hasProject = !!min;

    const focusDate = hasProject ? startOfDay(min!) : today;
    const ganttMin = computeGanttMinForSpan(min);

    const focusPx = diffDays(ganttMin, focusDate) * pxPerDay;

    const marginDays = 3;
    const targetPx = Math.max(0, focusPx - marginDays * pxPerDay);

    const vw = bar.clientWidth || 1;
    const maxScroll = Math.max(0, measure.scrollWidth - vw);
    const nextScroll = Math.max(0, Math.min(maxScroll, Math.round(targetPx)));

    bar.scrollLeft = nextScroll;
  };

  useEffect(() => {
    // Initial focus kun hvis prosjektet er "tomt"
    // (Snapshot / open / import håndterer fokus selv)
    const hasAnyDates = rows.some((r) => {
      const c = (r as any)?.cells;
      return (
        String(c?.start ?? "").trim() ||
        String(c?.end ?? "").trim()
      );
    });
  
    if (!hasAnyDates) {
      requestGanttFocus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ganttFocusToken) return;

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        focusGanttToProjectStartOrToday(rows);
      });
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttFocusToken]);
  // ============================
  // BLOCK: GANTT_FOCUS (END)
  // ============================

  // ============================
  // BLOCK: GANTT_ZOOM_STABLE_ANCHOR (START)
  // ============================
  type PendingZoom = {
    anchorDate: Date; // prosjektstart eller i dag
    anchorClientX: number | null; // brukes kun for å plassere ankeret pent i viewport
    targetZoomIdx: number;
  };

  const pendingZoomRef = useRef<PendingZoom | null>(null);

  const pickAnchorDate = (rowsSnapshot: RowData[]) => {
    const { min } = getProjectSpanFromRows(rowsSnapshot);
    return min ? startOfDay(min) : startOfDay(new Date());
  };

  const applyZoomScroll = (pz: PendingZoom) => {
    const bar = ganttBarRef.current;
    const measure = ganttMeasureRef.current;
    if (!bar || !measure) return;

    const newPx = ganttZoomLevels[pz.targetZoomIdx] ?? ganttPxPerDay;

    const rowsSnapshot = rows;
    const span = getProjectSpanFromRows(rowsSnapshot);
    const ganttMin = computeGanttMinForSpan(span.min);

    const anchorPx = diffDays(ganttMin, pz.anchorDate) * newPx;

    const vw = bar.clientWidth || 1;

    let desiredX = Math.min(240, Math.round(vw * 0.33));

    if (pz.anchorClientX !== null) {
      const r = bar.getBoundingClientRect();
      const x = pz.anchorClientX - r.left;
      if (Number.isFinite(x) && x >= 0 && x <= r.width) {
        desiredX = Math.max(0, Math.min(vw, Math.round(x)));
      }
    }

    const raw = anchorPx - desiredX;

    const maxScroll = Math.max(0, measure.scrollWidth - vw);
    const nextScroll = Math.max(0, Math.min(maxScroll, Math.round(raw)));

    bar.scrollLeft = nextScroll;
  };

  const handleGanttZoomDelta = (
    deltaSteps: number,
    anchorClientX: number | null
  ) => {
    const nextIdx = Math.max(
      0,
      Math.min(ganttZoomLevels.length - 1, ganttZoomIdx + deltaSteps)
    );

    if (nextIdx === ganttZoomIdx) return;

    pendingZoomRef.current = {
      anchorDate: pickAnchorDate(rows),
      anchorClientX,
      targetZoomIdx: nextIdx,
    };

    setGanttZoomIdx(nextIdx);
  };

  useEffect(() => {
    const pz = pendingZoomRef.current;
    if (!pz) return;
    if (pz.targetZoomIdx !== ganttZoomIdx) return;

    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        applyZoomScroll(pz);
        pendingZoomRef.current = null;
      });
      return () => cancelAnimationFrame(raf2);
    });

    return () => cancelAnimationFrame(raf1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ganttZoomIdx]);
  // ============================
  // BLOCK: GANTT_ZOOM_STABLE_ANCHOR (END)
  // ============================

  // ============================
  // BLOCK: TSV_IMPORT (START)
  // ============================
  const importTSV = async () => {
    const picked = await pickTextFile(
      ".tsv,text/tab-separated-values,text/plain"
    );
    if (!picked) return;

    const matrix = parseClipboard(picked.text);
    if (!matrix.length) return;

    const first = matrix[0].map((x) => String(x ?? "").trim());
    const hasHeader =
      first.length >= 2 &&
      (first[0].toLowerCase() === "indent" ||
        first[0].toLowerCase() === "innrykk" ||
        first.includes("title"));

    let startRow = 0;
    let idxIndent = 0;
    const colIndexByKey = new Map<string, number>();

    if (hasHeader) {
      startRow = 1;
      idxIndent = first.findIndex(
        (h) => h.toLowerCase() === "indent" || h.toLowerCase() === "innrykk"
      );
      if (idxIndent < 0) idxIndent = 0;

      for (let i = 0; i < first.length; i++) {
        colIndexByKey.set(first[i], i);
      }
    } else {
      idxIndent = 0;
      colIndexByKey.set("Indent", 0);
      columns.forEach((c, i) => colIndexByKey.set(c.key, i + 1));
      startRow = 0;
    }

    const imported: RowData[] = [];

    for (let r = startRow; r < matrix.length; r++) {
      const row = matrix[r];
      if (!row || row.length === 0) continue;

      const indentRaw = row[idxIndent] ?? "0";
      const indent = Number(String(indentRaw).trim());
      const safeIndent = Number.isFinite(indent)
        ? Math.max(0, Math.min(20, Math.floor(indent)))
        : 0;

      const cells: Record<string, any> = {};
      for (const c of columns) {
        let idx = colIndexByKey.get(c.key);
        if (idx === undefined && hasHeader) {
          idx = colIndexByKey.get(c.title);
        }
        if (idx === undefined) idx = -1;
        const v = idx >= 0 ? row[idx] : "";
        cells[c.key] = v === undefined || v === null ? "" : String(v);
      }

      const hasAny =
        String(cells.title ?? "").trim().length > 0 ||
        String(cells.start ?? "").trim().length > 0 ||
        String(cells.end ?? "").trim().length > 0 ||
        String(cells.dur ?? "").trim().length > 0;

      if (!hasAny) continue;

      imported.push({
        id: `r${imported.length + 1}`,
        indent: safeIndent,
        cells,
      });
    }

    const target = Math.max(120, imported.length);
    for (let i = imported.length; i < target; i++) {
      imported.push({
        id: `r${i + 1}`,
        indent: 0,
        cells: {
          title: "",
          start: "",
          end: "",
          dur: "",
          dep: "",
          wbs: "",
          owner: "",
          note: "",
        },
      });
    }

    const computed = computeDerivedRows(imported, progressCalendar, {
      title: "title",
      start: "start",
      end: "end",
      dur: "dur",
    });

    requestGanttFocus();
    setRows(computed);
  };
  // ============================
  // BLOCK: TSV_IMPORT (END)
  // ============================

  // ============================
  // BLOCK: FILE_MENU_HANDLER (START)
  // ============================
    const resetToBlankProject = useCallback(() => {
    setCurrentProjectId(null);
    setCurrentCloudProjectId(null);

    setSelection(null);

    setProjectInfo({
      projectName: "",
      customerName: "",
      projectNo: "",
      baseStartISO: new Date().toISOString().slice(0, 10),
      workWeekDays: 5,
      notes: "",
      owners: [],
    });

    setCalendarEntries([]);

    // Reset kolonnevalg til default (alle synlige)
    setAppColumns(columns.map((c) => ({ ...c, visible: true, custom: false })));

    requestGanttFocus();
    setRows(buildBlankRows(120));
    setProjectOpen(true);
  }, [columns]);

  const handleFileAction = (action: any) => {
    const a =
      typeof action === "string"
        ? action
        : typeof action === "object" && action
        ? String(
            (action as any).id ??
              (action as any).action ??
              (action as any).key ??
              ""
          )
        : "";
  
    switch (a) {
      case "newBlank": {
        const plan = String(org.activePlan ?? "free");
        const isProOrTrial = plan === "pro" || plan === "trial";
  
        if (isProOrTrial) {
          // Pro/Trial: nytt prosjekt i ny fane (beholder denne fanen urørt)
          openNewProjectInNewTab();
          return;
        }
  
        // Free: samme fane (clean reset)
        resetToBlankProject();
        return;
            }
  
      case "save": {
        // "Lagre prosjekt":
        // alltid lokal lagring (IndexedDB) + "free snapshot" i localStorage
        // og i tillegg: Pro/Trial => skylagring
        (async () => {
          try {
            const snap = buildSnapshot();
  
            // 1 prosjekt "quick restore" i localStorage (brukes av Free via "Åpne prosjekt")
            try {
              lsWriteString(
                PROGRESS_KEYS.freeProjectSnapshotV1,
                JSON.stringify(snap)
              );
            } catch {}
  
            const rec = await projectStore.upsert({
              id: currentProjectId ?? undefined,
              title: snap.title,
              snapshot: snap,
            });
            setCurrentProjectId(rec.id);
  
            // Pro/Trial: lagre i sky også
            try {
              void saveToCloudProOnly();
            } catch {}
          } catch (e) {
            console.warn("[Progress][LocalDB] Save failed:", e);
          }
        })();
        return;
      }
  
      case "saveCloud": {
        // Backwards compat (UI-knappen kan være fjernet, men vi støtter fortsatt action)
        void saveToCloudProOnly();
        return;
      }
  
      case "openProject": {
        // Free => localStorage (ett prosjekt). Pro/Trial => prosjektbibliotek (cloud)
        const plan = String(org.activePlan ?? "free");
        const isProOrTrial = plan === "pro" || plan === "trial";
  
        if (isProOrTrial) {
          setProjectLibraryOpen(true);
          return;
        }
  
        // Free: åpne sitt ene arbeidsprosjekt fra localStorage
        try {
          const raw = lsReadString(PROGRESS_KEYS.freeProjectSnapshotV1, null);
          const snap = raw ? safeParseJSON<ProgressProjectSnapshotV1>(raw) : null;
          if (snap && (snap as any).v === 1) {
            applySnapshot(snap);
            return;
          }
        } catch {}
  
        // Hvis ingen snapshot finnes: start blankt
        requestGanttFocus();
        setRows(buildBlankRows(120));
        return;
      }
  
      case "openFile": {
        (async () => {
          try {
            const picked = await pickTextFile(".mclp,application/json");
            if (!picked) return;
  
            const snap = safeParseJSON<ProgressProjectSnapshotV1>(picked.text);
            if (!snap || (snap as any).v !== 1) {
              console.warn("[Progress] Invalid .mclp file:", picked.name);
              return;
            }
  
            applySnapshot(snap);
  
            // Free skal kunne "ta over" mottatt fil som sitt ene arbeidsprosjekt (localStorage)
            try {
              lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
            } catch {}
          } catch (e) {
            console.warn("[Progress] Open file failed:", e);
          }
        })();
        return;
      }
  
      case "openRecent": {
        setProjectLibraryOpen(true);
        return;
      }
  
      case "open": {
        // Backwards compat
        (async () => {
          try {
            const picked = await pickTextFile(".mclp,application/json");
            if (!picked) return;
  
            const snap = safeParseJSON<ProgressProjectSnapshotV1>(picked.text);
            if (!snap || (snap as any).v !== 1) return;
  
            applySnapshot(snap);
            try {
              lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
            } catch {}
          } catch {}
        })();
        return;
      }
  
      case "saveAs": {
        const plan = String(org.activePlan ?? "free");
        const isProOrTrial = plan === "pro" || plan === "trial";
        if (!isProOrTrial) return;
  
        try {
          const snap = buildSnapshot();
          const safeTitle = String((snap as any)?.title ?? "project")
            .replace(/[^a-zA-Z0-9\-_. æøåÆØÅ]/g, " ")
            .trim()
            .slice(0, 80)
            .replace(/\s+/g, " ");
          const filename = `${safeTitle || "project"}.mclp`;
          downloadTextFile(
            filename,
            "application/json",
            JSON.stringify(snap, null, 2)
          );
        } catch (e) {
          console.warn("[Progress] Save As failed:", e);
        }
        return;
      }
  
      case "exportTsv": {
        exportTSV();
        return;
      }
  
      case "importTsv": {
        importTSV();
        return;
      }
  
      case "exportCsv": {
        console.warn("[Progress] exportCsv not implemented yet");
        return;
      }
  
      case "print": {
        setPrint2Open(true);
        return;
      }
  
      default: {
        console.warn("[Progress] Unknown file action:", a, action);
        return;
      }
    }
  };
  // ============================
  // BLOCK: FILE_MENU_HANDLER (END)
  // ============================


  const handleGanttAction = (action: any) => {
    const a =
      typeof action === "string"
        ? action
        : typeof action === "object" && action
        ? String(
            (action as any).id ??
              (action as any).action ??
              (action as any).key ??
              ""
          )
        : "";

    switch (a) {
      case "zoomIn":
        handleGanttZoomDelta(+1, null);
        return;
      case "zoomOut":
        handleGanttZoomDelta(-1, null);
        return;
      case "zoomReset": {
        const target = 11; // default (32px per day)
        if (target === ganttZoomIdx) return;
        pendingZoomRef.current = {
          anchorDate: pickAnchorDate(rows),
          anchorClientX: null,
          targetZoomIdx: target,
        };
        setGanttZoomIdx(target);
        return;
      }
      case "toggleWeekend":
        setGanttWeekendShade((v) => !v);
        return;
      case "toggleTodayLine":
        setGanttTodayLine((v) => !v);
        return;
      default:
        console.warn("[Progress] Unknown gantt action:", a, action);
        return;
    }
  };

  const handleCalendarAction = (action: any) => {
    const a =
      typeof action === "string"
        ? action
        : typeof action === "object" && action
        ? String(
            (action as any).id ??
              (action as any).action ??
              (action as any).key ??
              ""
          )
        : "";

    switch (a) {
      case "calendarManage":
        setCalendarOpen(true);
        return;
      default:
        console.warn("[Progress] Unknown calendar action:", a, action);
        return;
    }
  };

  const handleProjectAction = (action: any) => {
    const a =
      typeof action === "string"
        ? action
        : typeof action === "object" && action
        ? String(
            (action as any).id ??
              (action as any).action ??
              (action as any).key ??
              ""
          )
        : "";

    switch (a) {
      case "projectManage":
        setProjectOpen(true);
        return;
    
      // ✅ NY: "Åpne prosjekt" knappen
      case "openProject": {
        const plan = String(org.activePlan ?? "free");
        const isPro = plan === "pro" || plan === "trial";
    
        if (isPro) {
          // Pro/Trial: åpner prosjektlisten (IndexedDB nå, Firestore senere)
          setProjectLibraryOpen(true);
          return;
        }
    
        // Free: åpner sitt ene arbeidsprosjekt fra localStorage
        try {
          const raw = lsReadString(PROGRESS_KEYS.freeProjectSnapshotV1, null);
          const snap = raw ? safeParseJSON<ProgressProjectSnapshotV1>(raw) : null;
          if (snap && (snap as any).v === 1) {
            applySnapshot(snap);
            return;
          }
        } catch {}
    
        // Hvis Free ikke har noe lagret ennå: start blankt
        requestGanttFocus();
        setRows(buildBlankRows(120));
        return;
      }
    
      default:
        console.warn("[Progress] Unknown project action:", a, action);
        return;
    }
  };

  const handleTableAction = (action: any) => {
    const a =
      typeof action === "string"
        ? action
        : typeof action === "object" && action
        ? String(
            (action as any).id ??
              (action as any).action ??
              (action as any).key ??
              ""
          )
        : "";

    switch (a) {
      case "columnsManage": {
        setColMgrOpen(true);
        return;
      }

      case "addRowEnd": {
        const nextCols = ensureAtLeastTitleVisible(appColumns);
        const nextRows = addRowAtEnd(rows, nextCols, 120);
        setAppColumns(nextCols);
        onRowsChange(applyColumnsToRows(nextCols, nextRows));
        return;
      }

      case "addRowBelow": {
        const nextCols = ensureAtLeastTitleVisible(appColumns);
        const nextRows = addRowBelowSelection(rows, nextCols, selection, 120);
        setAppColumns(nextCols);
        onRowsChange(applyColumnsToRows(nextCols, nextRows));
        return;
      }

      case "deleteSelectedRows": {
        const nextCols = ensureAtLeastTitleVisible(appColumns);
        const nextRows = deleteSelectedRows(rows, nextCols, selection, 120);
        setAppColumns(nextCols);
        onRowsChange(applyColumnsToRows(nextCols, nextRows));
        return;
      }

      default:
        console.warn("[Progress] Unknown table action:", a, action);
        return;
    }
  };

  // ============================
  // BLOCK: JSX (START)
  // ============================
  return (
    <div className="app-shell">
      <div className="mcl-watermark" aria-hidden="true">
        <img src={watermarkUrl} alt="" />
      </div>

      <Header
        onToggleHelp={() => setHelpOpen(true)}
        account={{
          apiBase: apiBase,
          authReady: auth.ready,
          userEmail: authEmail,
          plan: org.activePlan,
          expiresAt: org.expiresAt,
          errorText: org.error || null,
          signIn: auth.signIn,
          register: registerAndStartTrial,
          signOut: auth.signOut,
          getIdToken: auth.getIdToken,
          refreshPlan: org.refresh,
        }}
      />

      <Toolbar
        left={
          <ProgressToolbar
            activePlan={org.activePlan}
            confirmOnNew={String(org.activePlan ?? "free") === "free"}
            onFileAction={handleFileAction}
            onTableAction={handleTableAction}
            onGanttAction={handleGanttAction}
            onCalendarAction={handleCalendarAction}
            onProjectAction={handleProjectAction}

            workWeekDays={projectInfo.workWeekDays}
            onSetWorkWeekDays={(next) => setProjectInfo((p) => ({ ...p, workWeekDays: next }))}

            ganttShowBarText={ganttShowBarText}
            onSetGanttShowBarText={setGanttShowBarText}

            ganttDefaultBarColor={ganttDefaultBarColor}
            onSetGanttDefaultBarColor={setGanttDefaultBarColor}
          />
        }
        center={null}
        right={null}
      />

      <main className="app-main">
        <section className="app-section app-section--split-card">
          <div className="split-card">
            <div className="split-body">
              <div
                className="split-grid"
                ref={splitGridRef}
                style={{ ["--split-left" as any]: splitLeft }}
              >
                <div className="split-panel">
                  <div className="split-panel-clip">
                    <div
                      className="split-track split-track--table"
                      ref={tableHostRef}
                    >
                      <div className="split-measure" ref={tableMeasureRef}>
                        <TableCore
                          columns={visibleColumnsPatched}
                          rows={rows}
                          onChange={onRowsChange}
                          onCellCommit={onCellCommit}
                          onRequestDatePicker={onRequestDatePicker}
                          showSummary
                          headerInfoText={headerInfo}
                          onVisibleRowIdsChange={setVisibleRowIds}
                          onSelectionChange={setSelection}
                      
                          // ✅ NY: Oppdater prosjektets kolonnebredder når brukeren resizer/flytter kolonner
                          onColumnsChange={(nextCols: ColumnDef[]) => {
                            setAppColumns((prev) => {
                              // nextCols kommer fra TableCore (typisk "synlige kolonner") og har korrekt rekkefølge + ev. nye widths
                              const nextByKey = new Map(nextCols.map((c) => [c.key, c]));
                              const nextKeys = nextCols.map((c) => c.key);
                          
                              const prevByKey = new Map(prev.map((c) => [c.key, c]));
                          
                              // 1) Bygg ny rekkefølge basert på nextCols (dvs. drag/drop-rekkefølgen)
                              const reorderedVisible = nextKeys
                                .map((key) => {
                                  const prevCol = prevByKey.get(key);
                                  const nextCol = nextByKey.get(key);
                                  if (!prevCol || !nextCol) return null;
                          
                                  // behold alle app-eide properties, men ta med width fra TableCore når den finnes
                                  return {
                                    ...prevCol,
                                    width: nextCol.width ?? prevCol.width,
                                  } as ColumnDef;
                                })
                                .filter(Boolean) as ColumnDef[];
                          
                              // 2) Behold kolonner som ikke var i nextCols (typisk skjulte), uten å miste dem
                              const seen = new Set(nextKeys);
                              const untouched = prev.filter((c) => !seen.has(c.key));
                          
                              return [...reorderedVisible, ...untouched];
                            });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  className="split-divider"
                  role="separator"
                  aria-orientation="vertical"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(splitLeft)}
                  tabIndex={0}
                  onPointerDown={onDividerPointerDown}
                  onKeyDown={onDividerKeyDown}
                  title={t("app.split.dragToResize")}
                >
                  <div className="split-divider-grip" aria-hidden="true" />
                </div>

                <div className="split-panel">
                  <div className="split-panel-clip">
                    <div
                      className="split-track split-track--gantt"
                      ref={ganttHostRef}
                    >
                      <div className="split-measure" ref={ganttMeasureRef}>
                        <GanttView
                          columns={visibleColumnsPatched}
                          rows={rows}
                          headerInfoText={headerInfo}
                          dateFormat="dd.mm.yyyy"
                          visibleRowIds={visibleRowIds}
                          pxPerDay={ganttPxPerDay}
                          onZoomDelta={(step, anchorX) =>
                            handleGanttZoomDelta(step, anchorX)
                          }
                          workWeekdays={progressCalendar.workWeekdays}
                          showWeekendShade={ganttWeekendShade}
                          showTodayLine={ganttTodayLine}
                          ownerColors={ownerColorMap}
                          dependencyLinks={deps.links}
                          showBarText={ganttShowBarText}
                          defaultBarColor={ganttDefaultBarColor}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="split-xbars">
              <div
                className="split-xbar-grid"
                style={{ ["--split-left" as any]: splitLeft }}
              >
                <div
                  className="split-xbar"
                  ref={tableBarRef}
                  aria-label={t("app.aria.tableHorizontalScroll")}
                >
                  <div className="split-xbar-spacer" ref={tableSpacerRef} />
                </div>

                <div className="split-xbar-divider" aria-hidden="true" />

                <div
                  className="split-xbar"
                  ref={ganttBarRef}
                  aria-label={t("app.aria.ganttHorizontalScroll")}
                >
                  <div className="split-xbar-spacer" ref={ganttSpacerRef} />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <DurationAdjustPopover
        state={durPop}
        onPick={applyDurationChoice}
        onClose={closeDurationPopover}
        titleText={t("app.durationPopover.title")}
        moveStartText={t("app.durationPopover.moveStart")}
        moveEndText={t("app.durationPopover.moveEnd")}
        keepEndMoveStartTitle={t("app.durationPopover.keepEndMoveStartTitle")}
        keepStartMoveEndTitle={t("app.durationPopover.keepStartMoveEndTitle")}
      />

      <WeekendAdjustPopover
        state={weekendPop}
        onPick={applyWeekendChoice}
        onCancel={cancelWeekendAdjust}
        titleText={t("app.weekendPopover.title")}
        prevText={t("app.weekendPopover.prevWorkday")}
        nextText={t("app.weekendPopover.nextWorkday")}
        cancelText={t("app.weekendPopover.cancel")}
      />
      
      <AppDatePickerPopover req={datePickReq as any} onRequestClose={closeDatePickerUI} />
      
      <ColumnManagerModal
        open={colMgrOpen}
        columns={appColumns}
        onClose={() => setColMgrOpen(false)}
        onChange={(next) => setAppColumns(ensureAtLeastTitleVisible(next))}
        onAddColumn={(spec) => {
          const nextCols = ensureAtLeastTitleVisible(
            addCustomColumn(appColumns, spec)
          );
          const nextRows = applyColumnsToRows(nextCols, rows);
          setAppColumns(nextCols);
          setRows(nextRows);
        }}
      />

      <CalendarModal
        open={calendarOpen}
        entries={calendarEntries}
        onChange={setCalendarEntries}
        onClose={() => setCalendarOpen(false)}
      />

      <ProjectModal
        open={projectOpen}
        value={projectInfo}
        onChange={setProjectInfo}
        onClose={() => setProjectOpen(false)}
      />

      {isPaid && org.activeOrgId ? (
        <CloudProjectLibraryModal
          open={projectLibraryOpen}
          currentId={currentCloudProjectId}
          onSetCurrentId={setCurrentCloudProjectId}
          onClose={() => setProjectLibraryOpen(false)}
          onOpenProject={(rec) => {
            setCurrentProjectId(rec.id);
            applySnapshot(rec.snapshot);
          }}
          apiBase={apiBase}
          auth={auth}
          orgId={org.activeOrgId}
        />
      ) : (
        <ProjectLibraryModal
          open={projectLibraryOpen}
          db={projectStore}
          currentId={currentProjectId}
          onSetCurrentId={setCurrentProjectId}
          onClose={() => setProjectLibraryOpen(false)}
          onOpenProject={(rec) => {
            setCurrentProjectId(rec.id);
            applySnapshot(rec.snapshot);
          }}
        />
      )}

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      {print2Open ? (
        <PrintPreviewOverlay
          columns={printColumnsPatched}
          rows={rows}
          showBarLabels={ganttShowBarText}
          dependencies={deps.links}
          projectInfo={projectInfo}
          logoSrc={undefined}
          showWatermark={!isPaid}
          watermarkSvgSrc={watermarkUrl}
          defaultBarColor={ganttDefaultBarColor} 
          onClose={() => setPrint2Open(false)}
        />
      ) : null}

      <footer className="app-footer">
        <div className="app-footer-inner">
          <a
            href={LINKS.mcl}
            target="_blank"
            rel="noopener noreferrer"
            className="app-footer-brand"
          >
            {t("app.footer.copyright")}
          </a>
      
          <span className="app-footer-links">
            <a
              href={`${LINKS.mcl}/#brukervilkar`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("app.footer.terms")}
            </a>
      
            <span className="app-footer-separator">•</span>
      
            <a
              href={`${LINKS.mcl}/#personvern`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("app.footer.privacy")}
            </a>
          </span>
      
          <span className="app-footer-icon" aria-hidden="true">
            ☕
          </span>
        </div>
      </footer>
    </div>
  );
  // ============================
  // BLOCK: JSX (END)
  // ============================
}
// ============================
// BLOCK: APP_COMPONENT (END)
// ============================
