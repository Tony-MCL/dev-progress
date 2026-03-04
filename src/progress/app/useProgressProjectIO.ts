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

type CalendarLike = {
  workWeekDays: 5 | 6 | 7;
  entries: CalendarEntry[];
};

type Args = {
  // org/plan
  org: { activeOrgId: string | null; activePlan: string | null };
  apiBase: string | null;

  // auth
  authUid: string | null;
  auth: { getIdToken: (forceRefresh: boolean) => Promise<string | null> };

  // current project info
  projectInfo: ProjectInfo;
  setProjectInfo: (x: ProjectInfo) => void;

  // table state
  rows: RowData[];
  setRows: (x: RowData[]) => void;

  selection: Selection | null;
  setSelection: (x: Selection | null) => void;

  appColumns: AppColumnDef[];
  setAppColumns: (x: AppColumnDef[]) => void;

  // gantt ui
  ganttShowBarText: boolean;
  setGanttShowBarText: (b: boolean) => void;

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

  // stores / calendar
  projectStore: IndexedDbStore;
  progressCalendar: CalendarLike;

  // gantt refs (for focus/zoom scroll)
  ganttBarRef: React.RefObject<HTMLDivElement>;
  ganttGridRef: React.RefObject<HTMLDivElement>;
  ganttScrollRef: React.RefObject<HTMLDivElement>;

  // row pipeline
  onRowsChange: (next: RowData[]) => void;

  // view / state
  setGanttWeekendShade: (b: boolean) => void;
  setGanttTodayLine: (b: boolean) => void;
};

function buildBlankRows(n: number): RowData[] {
  return Array.from({ length: n }).map((_, idx) => ({
    id: String(idx + 1),
    cells: {
      title: "",
      start: "",
      end: "",
      duration: "",
      owner: "",
      color: "",
      deps: "",
    },
    meta: {},
  })) as any;
}

function fallbackCloudTitle(title: string) {
  const t = String(title || "").trim();
  if (t) return t;
  return "Untitled project";
}

export function useProgressProjectIO({
  org,
  apiBase,

  authUid,
  auth,

  projectInfo,
  setProjectInfo,

  rows,
  setRows,

  selection,
  setSelection,

  appColumns,
  setAppColumns,

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
  ganttGridRef,
  ganttScrollRef,

  onRowsChange,

  setGanttWeekendShade,
  setGanttTodayLine,
}: Args) {
  const zoomRef = useRef<{ pxPerDay: number }>({ pxPerDay: 18 });

  const requestGanttFocus = useCallback(() => {
    const el = ganttScrollRef.current;
    if (!el) return;
    el.focus?.();
  }, [ganttScrollRef]);

  const handleGanttZoomDelta = useCallback(
    (step: number, anchorX: number | null) => {
      const el = ganttScrollRef.current;
      if (!el) return;

      const prev = zoomRef.current.pxPerDay;

      const next = Math.min(72, Math.max(8, prev + step * 2));
      if (next === prev) return;

      zoomRef.current.pxPerDay = next;

      const grid = ganttGridRef.current;
      const bar = ganttBarRef.current;
      if (!grid || !bar) return;

      const scrollLeft = el.scrollLeft;
      const clientX = anchorX ?? Math.floor(el.clientWidth / 2);

      const beforeX = scrollLeft + clientX;
      const ratio = next / prev;

      const afterX = beforeX * ratio;
      const nextScrollLeft = Math.max(0, Math.round(afterX - clientX));

      el.scrollLeft = nextScrollLeft;
    },
    [ganttBarRef, ganttGridRef, ganttScrollRef]
  );

  const resetGanttZoom = useCallback(() => {
    zoomRef.current.pxPerDay = 18;
  }, []);

  const buildSnapshot = useCallback((): ProgressProjectSnapshotV1 => {
    const usedCols = ensureAtLeastTitleVisible(appColumns);
    const usedRows = rows;

    const cleanInfo = {
      projectName: String(projectInfo.projectName || "").trim(),
      customerName: String(projectInfo.customerName || "").trim(),
      projectNo: String(projectInfo.projectNo || "").trim(),
      baseStartISO: String(projectInfo.baseStartISO || new Date().toISOString()),
    };

    const calendar = progressCalendar || defaultCalendar;

    const snap: ProgressProjectSnapshotV1 = {
      v: 1,
      title: cleanInfo.projectName || cleanInfo.projectNo || "Untitled project",
      projectInfo: cleanInfo as any,
      rows: usedRows as any,
      columns: usedCols as any,
      calendar: calendar as any,
      gantt: {
        showBarText: !!ganttShowBarText,
        defaultBarColor: String(ganttDefaultBarColor || "#b98a3a"),
      },
    };

    return snap;
  }, [
    appColumns,
    ganttDefaultBarColor,
    ganttShowBarText,
    progressCalendar,
    projectInfo,
    rows,
  ]);

  const applySnapshot = useCallback(
    (snap: ProgressProjectSnapshotV1) => {
      try {
        const nextRows = Array.isArray((snap as any).rows) ? ((snap as any).rows as any[]) : [];
        const nextCols = Array.isArray((snap as any).columns) ? ((snap as any).columns as any[]) : [];

        const nextInfo = (snap as any).projectInfo ?? null;
        const safeInfo: ProjectInfo = {
          projectName: String(nextInfo?.projectName ?? ""),
          customerName: String(nextInfo?.customerName ?? ""),
          projectNo: String(nextInfo?.projectNo ?? ""),
          baseStartISO: String(nextInfo?.baseStartISO ?? new Date().toISOString()),
        };

        const cal = (snap as any).calendar ?? defaultCalendar;

        const gantt = (snap as any).gantt ?? {};
        const showBarText = !!gantt?.showBarText;
        const defColor = String(gantt?.defaultBarColor || "#b98a3a");

        setProjectInfo(safeInfo);
        setAppColumns(ensureAtLeastTitleVisible(nextCols as any));
        setRows(nextRows as any);

        setGanttShowBarText(showBarText);
        setGanttDefaultBarColor(defColor);

        // apply calendar
        // Note: calendar is owned outside this hook in most setups.
        // If needed, wire a setter here in the future.

        requestGanttFocus();
        setSelection(null);
      } catch (e) {
        console.warn("[Progress] Failed to apply snapshot:", e);
      }
    },
    [
      requestGanttFocus,
      setAppColumns,
      setGanttDefaultBarColor,
      setGanttShowBarText,
      setProjectInfo,
      setRows,
      setSelection,
    ]
  );

  const openNewProjectInNewTab = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("_t", String(Date.now()));
      sp.delete("_p");
      sp.delete("_view");
      sp.delete("_q");
      sp.delete("_sel");
      sp.delete("_print");
      sp.delete("_z");
      sp.delete("_wd");
      sp.delete("_tl");
      sp.delete("_wk");

      const nextQs = sp.toString();
      const nextUrl = window.location.pathname + (nextQs ? `?${nextQs}` : "") + window.location.hash;
      window.open(nextUrl, "_blank");
    } catch (e) {
      console.warn("[Progress] Failed to open new tab:", e);
    }
  }, []);

  const startNewBlankProject = useCallback(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      sp.set("_t", String(Date.now()));
      sp.delete("_p");

      const nextQs = sp.toString();
      const nextUrl = window.location.pathname + (nextQs ? `?${nextQs}` : "") + window.location.hash;
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
        baseStartISO: new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
      });
    } catch (e) {
      console.warn("[Progress] startNewBlankProject failed:", e);
    }
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
      baseStartISO: new Date().toISOString().slice(0, 10) + "T00:00:00.000Z",
    });

    requestGanttFocus();
    setRows(buildBlankRows(120));
    setProjectOpen(true);
  }, [
    requestGanttFocus,
    setCurrentCloudProjectId,
    setCurrentProjectId,
    setProjectInfo,
    setProjectOpen,
    setRows,
    setSelection,
  ]);

  // ----------------------------
  // Cloud save (Pro/Trial only)
  // ----------------------------
  const saveCloudAsNewProOnly = useCallback(
    async (titleOverride?: string) => {
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
        const title = (titleOverride ?? "").trim() || fallbackCloudTitle(snap.title);

        // IMPORTANT: "Save as new" must NEVER overwrite an existing cloud project.
        // We force projectId=null so the backend creates a new record.
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
        console.log("[Progress][Cloud] Saved as new:", res.id);
      } catch (e) {
        console.warn("[Progress][Cloud] Save-as-new failed:", e);
      }
    },
    [
      org.activePlan,
      org.activeOrgId,
      apiBase,
      authUid,
      auth,
      buildSnapshot,
      setCurrentCloudProjectId,
    ]
  );

  const saveCloudUpdateProOnly = useCallback(
    async () => {
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

      // SAFETY RULE:
      // If we don't have an active cloudProjectId, an "update" is not allowed.
      // The caller should route to saveCloudAsNewProOnly (dialog) instead.
      if (!currentCloudProjectId) {
        console.warn(
          "[Progress][Cloud] No active cloudProjectId for update; refusing to overwrite."
        );
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
        console.log("[Progress][Cloud] Updated:", res.id);
      } catch (e) {
        console.warn("[Progress][Cloud] Update failed:", e);
      }
    },
    [
      org.activePlan,
      org.activeOrgId,
      apiBase,
      authUid,
      auth,
      buildSnapshot,
      currentCloudProjectId,
      setCurrentCloudProjectId,
    ]
  );

  // Back-compat alias used by older toolbar actions
  const saveToCloudProOnly = saveCloudUpdateProOnly;

  // ----------------------------
  // TSV export/import
  // ----------------------------
  const exportTSV = useCallback(() => {
    const used = rows.filter((r) => String((r as any)?.cells?.title ?? "").trim().length > 0);

    const header = [
      "title",
      "start",
      "end",
      "duration",
      "owner",
      "color",
      "deps",
      "indent",
      "collapsed",
      "done",
      "percent",
      "notes",
    ];

    const lines = [header.join("\t")];

    for (const r of used) {
      const c = (r as any).cells ?? {};
      const m = (r as any).meta ?? {};
      const indent = Number(m.indent ?? 0);
      const collapsed = !!m.collapsed;

      lines.push(
        [
          String(c.title ?? ""),
          String(c.start ?? ""),
          String(c.end ?? ""),
          String(c.duration ?? ""),
          String(c.owner ?? ""),
          String(c.color ?? ""),
          String(c.deps ?? ""),
          String(indent),
          String(collapsed),
          String(c.done ?? ""),
          String(c.percent ?? ""),
          String(c.notes ?? ""),
        ].join("\t")
      );
    }

    const text = lines.join("\n");
    downloadTextFile("progress.tsv", text);
  }, [rows]);

  const importTSV = useCallback(() => {
    (async () => {
      try {
        const picked = await pickTextFile(".tsv,text/tab-separated-values,text/plain");
        if (!picked) return;

        const parsed = parseClipboard(picked.text);
        const rowsTSV = parsed.rows;

        if (!rowsTSV || rowsTSV.length < 2) return;
        const header = rowsTSV[0].map((x) => String(x || "").trim().toLowerCase());
        const idx = (key: string) => header.indexOf(key);

        const mapRow = (cells: string[]) => {
          const get = (key: string) => {
            const i = idx(key);
            if (i < 0) return "";
            return String(cells[i] ?? "");
          };

          const indent = Number(get("indent") || 0);
          const collapsed = String(get("collapsed") || "").trim() === "true";

          return {
            id: String(Math.random()).slice(2),
            cells: {
              title: get("title"),
              start: get("start"),
              end: get("end"),
              duration: get("duration"),
              owner: get("owner"),
              color: get("color"),
              deps: get("deps"),
              done: get("done"),
              percent: get("percent"),
              notes: get("notes"),
            },
            meta: {
              indent,
              collapsed,
            },
          } as any;
        };

        const nextRows = rowsTSV.slice(1).map((r) => mapRow(r.map((x) => String(x ?? ""))));
        onRowsChange(nextRows as any);
      } catch (e) {
        console.warn("[Progress] Import TSV failed:", e);
      }
    })();
  }, [onRowsChange]);

  // ----------------------------
  // File actions
  // ----------------------------
  const handleFileAction = useCallback(
    (action: any) => {
      const a =
        typeof action === "string"
          ? action
          : typeof action === "object" && action
          ? String((action as any).id ?? (action as any).action ?? (action as any).key ?? "")
          : "";

      const title =
        typeof action === "object" && action ? String((action as any).title ?? (action as any).name ?? "") : "";

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
                title: snap.title,
                snapshot: snap,
              });
              setCurrentProjectId(rec.id);

              try {
                void saveCloudUpdateProOnly();
              } catch {}
            } catch (e) {
              console.warn("[Progress][LocalDB] Save failed:", e);
            }
          })();
          return;
        }

        case "saveCloud": {
          // Back-compat: old action id. Treat as cloudSaveUpdate.
          void saveCloudUpdateProOnly();
          return;
        }

        case "cloudSaveUpdate": {
          // NOTE: UI should prevent calling this when no cloudProjectId exists.
          // We still guard here to avoid accidental overwrites.
          if (!currentCloudProjectId) {
            // Safety: do not overwrite. Create a new project instead.
            void saveCloudAsNewProOnly(title);
            return;
          }
          void saveCloudUpdateProOnly();
          return;
        }

        case "cloudSaveAsNew": {
          void saveCloudAsNewProOnly(title);
          return;
        }

        case "cloudOpen": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";
          if (!isProOrTrial) return;
          setProjectLibraryOpen(true);
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
              if (!snap || (snap as any).v !== 1) {
                console.warn("[Progress] Invalid .mclp file:", picked.name);
                return;
              }

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

        case "openRecent": {
          setProjectLibraryOpen(true);
          return;
        }

        case "saveAs": {
          const plan = String(org.activePlan ?? "free");
          const isProOrTrial = plan === "pro" || plan === "trial";
          if (!isProOrTrial) return;

          const snap = buildSnapshot();
          const safeName = String(snap.title || "progress-project")
            .replace(/[^\w\d\-_. ]+/g, "")
            .trim()
            .replace(/\s+/g, "_")
            .slice(0, 64);

          const filename = `${safeName || "progress-project"}.mclp`;
          downloadTextFile(filename, JSON.stringify(snap, null, 2), "application/json");
          return;
        }

        case "print": {
          setPrint2Open(true);
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

        default:
          console.warn("[Progress] Unknown file action:", a, action);
          return;
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

    openNewProjectInNewTab, // exposed (useful in UI actions)
    resetToBlankProject, // exposed

    exportTSV,
    importTSV,

    handleFileAction,
  };
}
