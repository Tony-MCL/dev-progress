// src/progress/app/useProgressProjectIO.ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { ColumnDef, RowData, Selection } from "../../core/TableTypes";
import type { CalendarEntry } from "../CalendarModal";
import type { ProjectInfo } from "../ProjectModal";
import type { ProgressProjectSnapshotV1 } from "../../storage/projectDbTypes";
import type { AppColumnDef } from "../tableCommands";

import {
  computeDerivedRows,
  defaultCalendar,
  formatDMY,
  addWorkdays,
  parseDMYLoose,
} from "../ProgressCore";

import { recomputeAllRows } from "../autoSchedule";
import {
  startOfDay,
  diffDays,
  getProjectSpanFromRows,
  computeGanttMinForSpan,
} from "../ganttDateUtils";

import { parseClipboard, toTSV } from "../../core/utils/clipboard";
import { safeParseJSON, downloadTextFile, pickTextFile } from "../../core/utils/fileIO";
import { ensureAtLeastTitleVisible } from "../tableCommands";
import { PROGRESS_KEYS } from "../../storage/progressLocalKeys";
import { lsReadString, lsWriteString } from "../../storage/localSettings";
import { saveProgressProjectToCloud } from "../../cloud/cloudProjects";

type IndexedDbStore = {
  upsert: (x: {
    id?: string;
    title: string;
    snapshot: ProgressProjectSnapshotV1;
  }) => Promise<{ id: string }>;
};

type AuthLike = {
  getIdToken: (force?: boolean) => Promise<string | null>;
};

type OrgLike = {
  activePlan: string | null;
  activeOrgId: string | null;
};

type CalendarLike = {
  workWeekdays: Set<number>;
  nonWorkingDates: Set<string>;
};

export function useProgressProjectIO(args: {
  apiBase: string;
  auth: AuthLike;
  authUid: string | null;
  org: OrgLike;

  columns: ColumnDef[];
  buildBlankRows: (count: number) => RowData[];

  // state
  rows: RowData[];
  setRows: (next: RowData[] | ((prev: RowData[]) => RowData[])) => void;

  appColumns: AppColumnDef[];
  setAppColumns: (next: AppColumnDef[] | ((prev: AppColumnDef[]) => AppColumnDef[])) => void;

  projectInfo: ProjectInfo;
  setProjectInfo: (next: ProjectInfo | ((prev: ProjectInfo) => ProjectInfo)) => void;

  calendarEntries: CalendarEntry[];
  setCalendarEntries: (next: CalendarEntry[] | ((prev: CalendarEntry[]) => CalendarEntry[])) => void;

  selection: Selection | null;
  setSelection: (next: Selection | null) => void;

  // ui prefs
  splitLeft: number;
  setSplitLeft: (n: number) => void;

  ganttZoomIdx: number;
  setGanttZoomIdx: (n: number | ((prev: number) => number)) => void;

  ganttWeekendShade: boolean;
  setGanttWeekendShade: (b: boolean | ((prev: boolean) => boolean)) => void;

  ganttTodayLine: boolean;
  setGanttTodayLine: (b: boolean | ((prev: boolean) => boolean)) => void;

  ganttShowBarText: boolean;
  setGanttShowBarText: (b: boolean | ((prev: boolean) => boolean)) => void;

  ganttDefaultBarColor: string;
  setGanttDefaultBarColor: (s: string | ((prev: string) => string)) => void;

  setProjectOpen: (b: boolean) => void;
  setProjectLibraryOpen: (b: boolean) => void;
  setPrint2Open: (b: boolean) => void;

  // current project ids
  currentProjectId: string | null;
  setCurrentProjectId: (s: string | null) => void;

  currentCloudProjectId: string | null;
  setCurrentCloudProjectId: (s: string | null) => void;

  onSetFreeSnapshotBaseline?: (snap: ProgressProjectSnapshotV1 | null) => void;

  // stores / calendar
  projectStore: IndexedDbStore;
  progressCalendar: CalendarLike;

  // gantt refs (for focus/zoom scroll)
  ganttBarRef: React.RefObject<HTMLDivElement>;
  ganttMeasureRef: React.RefObject<HTMLDivElement>;

  // gantt zoom model (must match App.tsx)
  ganttZoomLevels: readonly number[];
  ganttPxPerDay: number;
}) {
  const {
    apiBase,
    auth,
    authUid,
    org,
    columns,
    buildBlankRows,
    rows,
    setRows,
    appColumns,
    setAppColumns,
    projectInfo,
    setProjectInfo,
    calendarEntries,
    setCalendarEntries,
    selection,
    setSelection,
    splitLeft,
    setSplitLeft,
    ganttZoomIdx,
    setGanttZoomIdx,
    ganttWeekendShade,
    setGanttWeekendShade,
    ganttTodayLine,
    setGanttTodayLine,
    ganttShowBarText,
    setGanttShowBarText,
    ganttDefaultBarColor,
    setGanttDefaultBarColor,
    setProjectOpen,
    setProjectLibraryOpen,
    setPrint2Open,
    currentProjectId,
    setCurrentProjectId,
    currentCloudProjectId,
    setCurrentCloudProjectId,
    onSetFreeSnapshotBaseline,
    projectStore,
    progressCalendar,
    ganttBarRef,
    ganttMeasureRef,
    ganttZoomLevels,
    ganttPxPerDay,
  } = args;

  // ----------------------------
  // Snapshot helpers
  // ----------------------------
  const fallbackCloudTitle = useCallback((snapTitle: string) => {
    const clean = String(snapTitle || "").trim();
    if (clean && clean !== "Untitled project") return clean;

    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `Prosjekt ${yyyy}-${mm}-${dd} ${hh}:${min}`;
  }, []);

  const buildProjectTitle = useCallback(() => {
    const p = String(projectInfo?.projectName ?? "").trim();
    const c = String(projectInfo?.customerName ?? "").trim();
    const no = String(projectInfo?.projectNo ?? "").trim();

    const left = [no, p].filter(Boolean).join(" , ");
    const title = [left, c].filter(Boolean).join(" • ");

    return title || "Untitled project";
  }, [projectInfo]);

  const buildSnapshot = useCallback((): ProgressProjectSnapshotV1 => {
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
  }, [
    buildProjectTitle,
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

  // ----------------------------
  // Gantt focus token + focus logic
  // ----------------------------
  const ganttFocusTokenRef = useRef(0);
  const [ganttFocusToken, setGanttFocusToken] = useState(0);

  const requestGanttFocus = useCallback(() => {
    ganttFocusTokenRef.current++;
    setGanttFocusToken(ganttFocusTokenRef.current);
  }, []);

  const focusGanttToProjectStartOrToday = useCallback(
    (rowsSnapshot: RowData[]) => {
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
    },
    [ganttBarRef, ganttMeasureRef, ganttPxPerDay]
  );

  // initial focus if empty project
  useEffect(() => {
    const hasAnyDates = rows.some((r) => {
      const c = (r as any)?.cells;
      return String(c?.start ?? "").trim() || String(c?.end ?? "").trim();
    });
    if (!hasAnyDates) requestGanttFocus();
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

  // ----------------------------
  // Gantt zoom stable anchor
  // ----------------------------
  type PendingZoom = {
    anchorDate: Date;
    anchorClientX: number | null;
    targetZoomIdx: number;
  };
  const pendingZoomRef = useRef<PendingZoom | null>(null);

  const pickAnchorDate = useCallback((rowsSnapshot: RowData[]) => {
    const { min } = getProjectSpanFromRows(rowsSnapshot);
    return min ? startOfDay(min) : startOfDay(new Date());
  }, []);

  const applyZoomScroll = useCallback(
    (pz: PendingZoom) => {
      const bar = ganttBarRef.current;
      const measure = ganttMeasureRef.current;
      if (!bar || !measure) return;

      const newPx = ganttZoomLevels[pz.targetZoomIdx] ?? ganttPxPerDay;

      const span = getProjectSpanFromRows(rows);
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
    },
    [ganttBarRef, ganttMeasureRef, ganttZoomLevels, ganttPxPerDay, rows]
  );

  const handleGanttZoomDelta = useCallback(
    (deltaSteps: number, anchorClientX: number | null) => {
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
    },
    [ganttZoomLevels.length, ganttZoomIdx, pickAnchorDate, rows, setGanttZoomIdx]
  );

  const resetGanttZoom = useCallback(() => {
    const target = 11; // default (32px per day)
    if (target === ganttZoomIdx) return;

    pendingZoomRef.current = {
      anchorDate: pickAnchorDate(rows),
      anchorClientX: null,
      targetZoomIdx: target,
    };

    setGanttZoomIdx(target);
  }, [ganttZoomIdx, pickAnchorDate, rows, setGanttZoomIdx]);

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

  // ----------------------------
  // Apply snapshot
  // ----------------------------
  const applySnapshot = useCallback(
    (snap: ProgressProjectSnapshotV1) => {
      const nextAppCols = Array.isArray((snap as any)?.appColumns)
        ? (snap as any).appColumns
        : appColumns;
      const nextRows = Array.isArray((snap as any)?.rows) ? (snap as any).rows : rows;

      const nextProjectInfo = ((snap as any)?.projectInfo ?? projectInfo) as ProjectInfo;
      const nextCalendarEntries = ((snap as any)?.calendarEntries ?? []) as CalendarEntry[];

      // build calendar synchronously for project switch correctness
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
      setRows(recomputeAllRows(nextRows, cal as any, null));

      const ui = (snap as any)?.ui ?? {};
      if (typeof ui.splitLeft === "number") setSplitLeft(ui.splitLeft);
      if (typeof ui.ganttZoomIdx === "number") setGanttZoomIdx(ui.ganttZoomIdx);
      if (typeof ui.ganttWeekendShade === "boolean") setGanttWeekendShade(ui.ganttWeekendShade);
      if (typeof ui.ganttTodayLine === "boolean") setGanttTodayLine(ui.ganttTodayLine);
      if (typeof ui.ganttShowBarText === "boolean") setGanttShowBarText(ui.ganttShowBarText);
      if (typeof ui.ganttDefaultBarColor === "string") setGanttDefaultBarColor(ui.ganttDefaultBarColor);

      requestGanttFocus();
    },
    [
      appColumns,
      rows,
      projectInfo,
      setAppColumns,
      setProjectInfo,
      setCalendarEntries,
      setRows,
      setSplitLeft,
      setGanttZoomIdx,
      setGanttWeekendShade,
      setGanttTodayLine,
      setGanttShowBarText,
      setGanttDefaultBarColor,
      requestGanttFocus,
    ]
  );

  // ----------------------------
  // Cloud save (Pro/Trial only)
  // ----------------------------
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
    apiBase,
    authUid,
    auth,
    buildSnapshot,
    fallbackCloudTitle,
    currentCloudProjectId,
    setCurrentCloudProjectId,
  ]);

  // ----------------------------
  // TSV export/import
  // ----------------------------
  const exportTSV = useCallback(() => {
    const used = rows.filter((r) => String((r as any)?.cells?.title ?? "").trim().length > 0);

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
    downloadTextFile(`progress-plan-${y}${m}${d}.tsv`, "text/tab-separated-values", text);
  }, [rows, columns]);

  const importTSV = useCallback(async () => {
    const picked = await pickTextFile(".tsv,text/tab-separated-values,text/plain");
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

      for (let i = 0; i < first.length; i++) colIndexByKey.set(first[i], i);
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
        if (idx === undefined && hasHeader) idx = colIndexByKey.get(c.title);
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
        cells: { title: "", start: "", end: "", dur: "", dep: "", wbs: "", owner: "", note: "" },
      });
    }

    const computed = computeDerivedRows(imported, progressCalendar as any, {
      title: "title",
      start: "start",
      end: "end",
      dur: "dur",
    });

    requestGanttFocus();
    setRows(computed);
  }, [columns, progressCalendar, requestGanttFocus, setRows]);

  // ----------------------------
  // New project in new tab (Pro/Trial)
  // ----------------------------
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
      window.location.pathname + (nextQs ? `?${nextQs}` : "") + window.location.hash;
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
    setAppColumns(columns.map((c) => ({ ...(c as any), visible: true, custom: false })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------
  // Reset blank project (Free, same tab)
  // ----------------------------
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
    setAppColumns(columns.map((c) => ({ ...(c as any), visible: true, custom: false })));

    requestGanttFocus();
    setRows(buildBlankRows(120));
    setProjectOpen(true);
  }, [
    buildBlankRows,
    columns,
    requestGanttFocus,
    setAppColumns,
    setCalendarEntries,
    setCurrentCloudProjectId,
    setCurrentProjectId,
    setProjectInfo,
    setProjectOpen,
    setRows,
    setSelection,
  ]);

  // ----------------------------
  // File menu handler
  // ----------------------------
  const handleFileAction = useCallback(
    (action: any) => {
      const a =
        typeof action === "string"
          ? action
          : typeof action === "object" && action
          ? String((action as any).id ?? (action as any).action ?? (action as any).key ?? "")
          : "";

      switch (a) {
        case "newBlank": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";

          if (isProOrTrial) {
            openNewProjectInNewTab();
            return;
          }

          resetToBlankProject();
          return;
        }

        case "save": {
          (async () => {
            try {
              const plan = String(org.activePlan ?? "free");
              const isProOrTrial = plan === "pro" || plan === "trial";

              const snap = buildSnapshot();

              try {
                lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
                onSetFreeSnapshotBaseline?.(snap);
              } catch {}

              // ✅ Free users: single-project slot only (localStorage). No hidden project library in IndexedDB.
              if (!isProOrTrial) {
                setCurrentProjectId(null);
                setCurrentCloudProjectId(null);
                return;
              }

              // ✅ Pro/Trial: persist to local library (IndexedDB) + best-effort cloud
              const rec = await projectStore.upsert({
                id: currentProjectId ?? undefined,
                title: snap.title,
                snapshot: snap,
              });
              setCurrentProjectId(rec.id);

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
          void saveToCloudProOnly();
          return;
        }

        case "openProject": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";

          if (isProOrTrial) {
            setProjectLibraryOpen(true);
            return;
          }

          try {
            const raw = lsReadString(PROGRESS_KEYS.freeProjectSnapshotV1, null);
            const snap = raw ? safeParseJSON<ProgressProjectSnapshotV1>(raw) : null;
            if (snap && (snap as any).v === 1) {
              applySnapshot(snap);
              onSetFreeSnapshotBaseline?.(snap);
              return;
            }
          } catch {}

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

              try {
                lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
                onSetFreeSnapshotBaseline?.(snap);
              } catch {}
            } catch (e) {
              console.warn("[Progress] Open file failed:", e);
            }
          })();
          return;
        }

        case "openRecent": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";

          if (isProOrTrial) {
            setProjectLibraryOpen(true);
            return;
          }

          // Free: behave like "Open project" (single-project slot)
          try {
            const raw = lsReadString(PROGRESS_KEYS.freeProjectSnapshotV1, null);
            const snap = raw ? safeParseJSON<ProgressProjectSnapshotV1>(raw) : null;
            if (snap && (snap as any).v === 1) {
              applySnapshot(snap);
              onSetFreeSnapshotBaseline?.(snap);
              return;
            }
          } catch {}

          requestGanttFocus();
          setRows(buildBlankRows(120));
          return;
        }

        case "open": {
          (async () => {
            try {
              const picked = await pickTextFile(".mclp,application/json");
              if (!picked) return;

              const snap = safeParseJSON<ProgressProjectSnapshotV1>(picked.text);
              if (!snap || (snap as any).v !== 1) return;

              applySnapshot(snap);
              try {
                lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
                onSetFreeSnapshotBaseline?.(snap);
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
            downloadTextFile(filename, "application/json", JSON.stringify(snap, null, 2));
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
          void importTSV();
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
    },
    [
      org.activePlan,
      openNewProjectInNewTab,
      resetToBlankProject,
      buildSnapshot,
      projectStore,
      currentProjectId,
      setCurrentProjectId,
      setCurrentCloudProjectId,
      saveToCloudProOnly,
      setProjectLibraryOpen,
      applySnapshot,
      requestGanttFocus,
      setRows,
      buildBlankRows,
      exportTSV,
      importTSV,
      setPrint2Open,
    ]
  );

  return {
    buildSnapshot,
    applySnapshot,
    saveToCloudProOnly,

    requestGanttFocus,
    handleGanttZoomDelta,
    resetGanttZoom,

    openNewProjectInNewTab, // exposed (useful in UI actions)
    resetToBlankProject, // exposed

    exportTSV,
    importTSV,

    handleFileAction,
  };
}
