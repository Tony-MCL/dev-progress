// src/progress/app/useProgressProjectIO.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef, RowData, Selection } from "../../core/TableTypes";
import type { CalendarEntry } from "../CalendarModal";
import type { ProjectInfo } from "../ProjectModal";
import type { ProgressProjectSnapshotV1 } from "../../storage/projectDbTypes";
import type { AppColumnDef } from "../tableCommands";

import { getProjectSpanFromRows } from "../ganttDateUtils";

import { parseClipboard, toTSV } from "../../core/utils/clipboard";
import { safeParseJSON, downloadTextFile, pickTextFile } from "../../core/utils/fileIO";
import { ensureAtLeastTitleVisible } from "../tableCommands";
import { PROGRESS_KEYS } from "../../storage/progressLocalKeys";
import { lsReadString, lsWriteString } from "../../storage/localSettings";
import { saveProgressProjectToCloud } from "../../cloud/cloudProjects";

type IndexedDbStore = {
  upsert: (x: { id?: string; title: string; snapshot: ProgressProjectSnapshotV1 }) => Promise<{ id: string }>;
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

function startOfDayLocal(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysBetween(a: Date, b: Date) {
  const ms = startOfDayLocal(b).getTime() - startOfDayLocal(a).getTime();
  return Math.round(ms / 86400000);
}

function clampZoomIdx(n: number, maxIdx: number) {
  return Math.max(0, Math.min(maxIdx, n));
}

export function useProgressProjectIO(args: {
  apiBase: string;
  auth: AuthLike;
  authUid: string | null;
  org: OrgLike;

  columns: ColumnDef[];
  buildBlankRows: (count: number) => RowData[];

  // ✅ compatibility with App.tsx
  ganttZoomLevels?: readonly number[];
  ganttPxPerDay?: number;

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
  setGanttZoomIdx: (n: number) => void;

  ganttWeekendShade: boolean;
  setGanttWeekendShade: (b: boolean | ((prev: boolean) => boolean)) => void;

  ganttTodayLine: boolean;
  setGanttTodayLine: (b: boolean | ((prev: boolean) => boolean)) => void;

  ganttShowBarText: boolean;
  setGanttShowBarText: (b: boolean) => void;

  ganttDefaultBarColor: string;
  setGanttDefaultBarColor: (s: string) => void;

  // modals
  setProjectOpen: (b: boolean) => void;
  setProjectLibraryOpen: (b: boolean) => void;
  setPrint2Open: (b: boolean) => void;

  // ids
  currentProjectId: string | null;
  setCurrentProjectId: (s: string | null) => void;

  currentCloudProjectId: string | null;
  setCurrentCloudProjectId: (s: string | null) => void;

  // stores / calendar
  projectStore: IndexedDbStore;
  progressCalendar: CalendarLike;

  // gantt refs
  ganttBarRef: React.RefObject<HTMLDivElement>;
  ganttMeasureRef: React.RefObject<HTMLDivElement>;
  ganttScrollRef: React.RefObject<HTMLDivElement>;

  // row pipeline
  onRowsChange: (next: RowData[]) => void;
}) {
  const {
    apiBase,
    auth,
    authUid,
    org,

    columns,
    buildBlankRows,

    ganttZoomLevels,
    ganttPxPerDay: ganttPxPerDayFromApp,

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

    projectStore,
    progressCalendar,

    ganttBarRef,
    ganttMeasureRef,
    ganttScrollRef,

    onRowsChange,
  } = args;

  const zoomLevels = useMemo(() => {
    const arr =
      Array.isArray(ganttZoomLevels) && ganttZoomLevels.length > 0 ? ganttZoomLevels : null;
    if (arr) return Array.from(arr).map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
    return [8, 10, 12, 14, 16, 18, 22, 26, 32, 40, 52, 64];
  }, [ganttZoomLevels]);

  // ✅ If App.tsx provides ganttPxPerDay, use it (it’s authoritative)
  const pxPerDay = useMemo(() => {
    const fromApp = Number(ganttPxPerDayFromApp);
    if (Number.isFinite(fromApp) && fromApp > 0) return fromApp;

    const idx = clampZoomIdx(ganttZoomIdx, zoomLevels.length - 1);
    return zoomLevels[idx] ?? 18;
  }, [ganttPxPerDayFromApp, ganttZoomIdx, zoomLevels]);

  const fallbackCloudTitle = useCallback((snapTitle: string) => {
    const t = String(snapTitle || "").trim();
    if (t) return t;
    return "Untitled project";
  }, []);

  const buildSnapshot = useCallback((): ProgressProjectSnapshotV1 => {
    const cal = {
      workWeekDays: (projectInfo as any)?.workWeekDays ?? 5,
      entries: calendarEntries ?? [],
    };

    const ui = {
      splitLeft,
      ganttZoomIdx,
      ganttWeekendShade,
      ganttTodayLine,
      ganttShowBarText,
      ganttDefaultBarColor,
    };

    const snap: any = {
      v: 1,
      title: String((projectInfo as any)?.projectName || (projectInfo as any)?.projectNo || "Untitled project"),
      projectInfo,
      rows,
      appColumns,
      calendar: cal,
      ui,
    };

    return snap as ProgressProjectSnapshotV1;
  }, [
    appColumns,
    calendarEntries,
    ganttDefaultBarColor,
    ganttShowBarText,
    ganttTodayLine,
    ganttWeekendShade,
    ganttZoomIdx,
    projectInfo,
    rows,
    splitLeft,
  ]);

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

      const today = startOfDayLocal(new Date());
      const span = getProjectSpanFromRows(rowsSnapshot);
      const hasProject = !!span?.min;

      const focusDate = hasProject ? startOfDayLocal(span.min as any) : today;
      const ganttMin = hasProject ? startOfDayLocal(span.min as any) : today;

      const focusPx = daysBetween(ganttMin, focusDate) * pxPerDay;

      const marginDays = 3;
      const targetPx = Math.max(0, focusPx - marginDays * pxPerDay);

      const vw = bar.clientWidth || 1;
      const maxScroll = Math.max(0, measure.scrollWidth - vw);
      const nextScroll = Math.max(0, Math.min(maxScroll, Math.round(targetPx)));

      bar.scrollLeft = nextScroll;
    },
    [ganttBarRef, ganttMeasureRef, pxPerDay]
  );

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
  }, [ganttFocusToken, focusGanttToProjectStartOrToday, rows]);

  const handleGanttZoomDelta = useCallback(
    (step: number, anchorX: number | null) => {
      // If App.tsx drives pxPerDay directly, we still allow changing zoomIdx,
      // but we can’t safely predict pxPerDay scaling here. So we only update the idx.
      if (Number.isFinite(Number(ganttPxPerDayFromApp)) && Number(ganttPxPerDayFromApp) > 0) {
        const nextIdx = clampZoomIdx(ganttZoomIdx + step, zoomLevels.length - 1);
        if (nextIdx !== ganttZoomIdx) setGanttZoomIdx(nextIdx);
        return;
      }

      const sc = ganttScrollRef.current;

      const prevIdx = clampZoomIdx(ganttZoomIdx, zoomLevels.length - 1);
      const nextIdx = clampZoomIdx(ganttZoomIdx + step, zoomLevels.length - 1);
      if (nextIdx === prevIdx) return;

      const prevPx = zoomLevels[prevIdx] ?? 18;
      const nextPx = zoomLevels[nextIdx] ?? 18;

      if (sc) {
        const clientX = anchorX ?? Math.floor(sc.clientWidth / 2);
        const beforeX = sc.scrollLeft + clientX;
        const ratio = nextPx / prevPx;
        const afterX = beforeX * ratio;
        sc.scrollLeft = Math.max(0, Math.round(afterX - clientX));
      }

      setGanttZoomIdx(nextIdx);
    },
    [ganttPxPerDayFromApp, ganttScrollRef, ganttZoomIdx, setGanttZoomIdx, zoomLevels]
  );

  const resetGanttZoom = useCallback(() => {
    setGanttZoomIdx(0);
  }, [setGanttZoomIdx]);

  const applySnapshot = useCallback(
    (snap: ProgressProjectSnapshotV1) => {
      const anySnap: any = snap as any;

      const nextRows = Array.isArray(anySnap?.rows) ? (anySnap.rows as RowData[]) : [];
      const nextCols = Array.isArray(anySnap?.appColumns) ? (anySnap.appColumns as AppColumnDef[]) : [];

      const nextInfo = anySnap?.projectInfo ?? null;

      const safeInfo: ProjectInfo = {
        projectName: String(nextInfo?.projectName ?? ""),
        customerName: String(nextInfo?.customerName ?? ""),
        projectNo: String(nextInfo?.projectNo ?? ""),
        baseStartISO: String(nextInfo?.baseStartISO ?? new Date().toISOString().slice(0, 10)),
        workWeekDays: Number(nextInfo?.workWeekDays ?? 5) as any,
        notes: String(nextInfo?.notes ?? ""),
        owners: Array.isArray(nextInfo?.owners) ? nextInfo.owners : [],
      };

      const cal = anySnap?.calendar ?? null;
      if (cal && Array.isArray(cal.entries)) setCalendarEntries(cal.entries);
      else setCalendarEntries([]);

      const ui = anySnap?.ui ?? null;
      if (ui) {
        if (typeof ui.splitLeft === "number") setSplitLeft(ui.splitLeft);
        if (typeof ui.ganttZoomIdx === "number") setGanttZoomIdx(ui.ganttZoomIdx);
        if (typeof ui.ganttWeekendShade === "boolean") setGanttWeekendShade(ui.ganttWeekendShade);
        if (typeof ui.ganttTodayLine === "boolean") setGanttTodayLine(ui.ganttTodayLine);
        if (typeof ui.ganttShowBarText === "boolean") setGanttShowBarText(ui.ganttShowBarText);
        if (typeof ui.ganttDefaultBarColor === "string") setGanttDefaultBarColor(ui.ganttDefaultBarColor);
      }

      setProjectInfo(safeInfo);
      setAppColumns(ensureAtLeastTitleVisible(nextCols));
      setRows(nextRows);
      setSelection(null);

      requestGanttFocus();
      focusGanttToProjectStartOrToday(nextRows);
    },
    [
      focusGanttToProjectStartOrToday,
      requestGanttFocus,
      setAppColumns,
      setCalendarEntries,
      setGanttDefaultBarColor,
      setGanttShowBarText,
      setGanttTodayLine,
      setGanttWeekendShade,
      setGanttZoomIdx,
      setProjectInfo,
      setRows,
      setSelection,
      setSplitLeft,
    ]
  );

  const openNewProjectInNewTab = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("_t", String(Date.now()));
      sp.delete("_p");

      const nextQs = sp.toString();
      const nextUrl = window.location.pathname + (nextQs ? `?${nextQs}` : "") + window.location.hash;
      window.open(nextUrl, "_blank");
    } catch (e) {
      console.warn("[Progress] Failed to open new tab:", e);
    }
  }, []);

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

  const saveCloudAsNewProOnly = useCallback(
    async (titleOverride?: string) => {
      const plan = String(org.activePlan ?? "free");
      const isProOrTrial = plan === "pro" || plan === "trial";
      if (!isProOrTrial) return;

      if (!apiBase) return;
      if (!authUid) return;
      if (!org.activeOrgId) return;

      try {
        const token = await auth.getIdToken(false);
        if (!token) return;

        const snap = buildSnapshot();
        const title = String(titleOverride ?? "").trim() || fallbackCloudTitle((snap as any).title);

        const res = await saveProgressProjectToCloud({
          apiBase,
          token,
          orgId: org.activeOrgId,
          uid: authUid,
          title,
          snapshot: snap,
          projectId: null,
        });

        setCurrentCloudProjectId(res.id);
      } catch (e) {
        console.warn("[Progress][Cloud] Save-as-new failed:", e);
      }
    },
    [apiBase, auth, authUid, buildSnapshot, fallbackCloudTitle, org.activeOrgId, org.activePlan, setCurrentCloudProjectId]
  );

  const saveCloudUpdateProOnly = useCallback(async () => {
    const plan = String(org.activePlan ?? "free");
    const isProOrTrial = plan === "pro" || plan === "trial";
    if (!isProOrTrial) return;

    if (!apiBase) return;
    if (!authUid) return;
    if (!org.activeOrgId) return;
    if (!currentCloudProjectId) return;

    try {
      const token = await auth.getIdToken(false);
      if (!token) return;

      const snap = buildSnapshot();

      const res = await saveProgressProjectToCloud({
        apiBase,
        token,
        orgId: org.activeOrgId,
        uid: authUid,
        title: fallbackCloudTitle((snap as any).title),
        snapshot: snap,
        projectId: currentCloudProjectId,
      });

      setCurrentCloudProjectId(res.id);
    } catch (e) {
      console.warn("[Progress][Cloud] Update failed:", e);
    }
  }, [
    org.activePlan,
    apiBase,
    authUid,
    org.activeOrgId,
    auth,
    buildSnapshot,
    fallbackCloudTitle,
    currentCloudProjectId,
    setCurrentCloudProjectId,
  ]);

  const saveToCloudProOnly = saveCloudUpdateProOnly;

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
    downloadTextFile(`progress-plan.tsv`, "text/tab-separated-values", text);
  }, [rows, columns]);

  const importTSV = useCallback(async () => {
    const picked = await pickTextFile(".tsv,text/tab-separated-values,text/plain");
    if (!picked) return;

    const rowsMatrix = parseClipboard(picked.text) as unknown as string[][];
    if (!Array.isArray(rowsMatrix) || rowsMatrix.length < 2) return;

    const header = (rowsMatrix[0] ?? []).map((x) => String(x || "").trim());
    const idxIndent = header.indexOf("Indent");

    const keyToIdx = new Map<string, number>();
    for (let i = 0; i < header.length; i++) keyToIdx.set(header[i], i);

    const nextRows: RowData[] = [];

    for (let r = 1; r < rowsMatrix.length; r++) {
      const row = rowsMatrix[r] ?? [];
      const indent = idxIndent >= 0 ? Number(row[idxIndent] ?? 0) : 0;

      const cells: any = {};
      for (const c of columns) {
        const i = keyToIdx.get(c.key);
        if (i === undefined) continue;
        cells[c.key] = row[i] ?? "";
      }

      nextRows.push({
        id: String(Math.random()).slice(2),
        cells,
        indent,
      } as any);
    }

    onRowsChange(nextRows);
  }, [columns, onRowsChange]);

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
              const snap = buildSnapshot();

              try {
                lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
              } catch {}

              const rec = await projectStore.upsert({
                id: currentProjectId ?? undefined,
                title: (snap as any).title,
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

        case "cloudOpen": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";
          if (!isProOrTrial) return;

          setProjectLibraryOpen(true);
          return;
        }

        case "cloudSaveUpdate": {
          if (!currentCloudProjectId) {
            const title = typeof action === "object" && action ? String((action as any).title ?? "") : "";
            void saveCloudAsNewProOnly(title);
            return;
          }

          void saveCloudUpdateProOnly();
          return;
        }

        case "cloudSaveAsNew": {
          const title = typeof action === "object" && action ? String((action as any).title ?? "") : "";
          void saveCloudAsNewProOnly(title);
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
              if (!snap || (snap as any).v !== 1) return;

              applySnapshot(snap);

              try {
                lsWriteString(PROGRESS_KEYS.freeProjectSnapshotV1, JSON.stringify(snap));
              } catch {}
            } catch (e) {
              console.warn("[Progress] Open file failed:", e);
            }
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
      currentCloudProjectId,
      saveToCloudProOnly,
      saveCloudUpdateProOnly,
      saveCloudAsNewProOnly,
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

    openNewProjectInNewTab,
    resetToBlankProject,

    exportTSV,
    importTSV,

    handleFileAction,
  };
}
