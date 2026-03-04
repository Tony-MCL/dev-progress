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
  TableCoreDatePreview,
} from "./core/TableTypes";

import Header from "./components/Header";
import HelpPanel from "./components/HelpPanel";
import Toolbar from "./components/Toolbar";

import GanttView from "./progress/GanttView";
import ProgressToolbar from "./progress/ProgressToolbar";
import PrintPreviewOverlay from "./print2/PrintPreviewOverlay";
import ColumnManagerModal from "./progress/ColumnManagerModal";
import { useDatePickerPopover } from "./progress/app/useDatePickerPopover";
import CalendarModal, { type CalendarEntry } from "./progress/CalendarModal";
import ProjectModal, { type ProjectInfo } from "./progress/ProjectModal";
import { useProgressProjectIO } from "./progress/app/useProgressProjectIO";
import { useProgressRowEditing } from "./progress/app/useProgressRowEditing";
import { useProgressViewModel } from "./progress/app/useProgressViewModel";
import CloudProjectLibraryModal from "./progress/CloudProjectLibraryModal";
import ProjectLibraryModal from "./progress/ProjectLibraryModal";
import { useAuthUser } from "./auth/useAuthUser";
import { useOrgContext } from "./orgs/useOrgContext";
import { setOptimisticPlan } from "./orgs/optimisticPlan";
import { createIndexedDbProjectStore } from "./storage/indexedDbProjectStore";
import type { ProgressProjectSnapshotV1 } from "./storage/projectDbTypes";
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
  ensureAtLeastTitleVisible,
  applyColumnsToRows,
  addCustomColumn,
  addRowAtEnd,
  addRowBelowSelection,
  deleteSelectedRows,
} from "./progress/tableCommands";

import {
  computeDerivedRows,
  defaultCalendar,
} from "./progress/ProgressCore";

import AppDatePickerPopover, {
  type DatePickerRequest,
} from "./progress/AppDatePickerPopover";

import { safeParseJSON } from "./core/utils/fileIO";
import { useBottomHScrollVar } from "./core/utils/useBottomHScrollVar";
import {
  clamp01to100,
} from "./progress/ganttDateUtils";
import { recomputeAllRows } from "./progress/autoSchedule";
import {
  DurationAdjustPopover,
  WeekendAdjustPopover,
} from "./progress/AdjustPopovers";

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
// ===========================

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

  // ============================
  // BLOCK: VIEW_MODEL (START)
  // ============================
  const {
    ownerColorMap,
    progressCalendar,
    deps,
    visibleColumnsPatched,
    printColumnsPatched,
    headerInfo,
  } = useProgressViewModel({
    t,
    rows,
    columns,
    appColumns,
    projectInfo,
    calendarEntries,
  });
  // ============================
  // BLOCK: VIEW_MODEL (END)
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
  // BLOCK: ROW_EDITING (START)
  // ============================
  const {
    durPop,
    weekendPop,
    onRowsChange,
    onCellCommit,
    applyWeekendChoice,
    cancelWeekendAdjust,
    applyDurationChoice,
    closeDurationPopover,
  } = useProgressRowEditing({
    rows,
    setRows,
    progressCalendar,
  });
  // ============================
  // BLOCK: ROW_EDITING (END)
  // ============================

  const { datePickReq, closeDatePickerUI, onRequestDatePicker } =
    useDatePickerPopover();

  const {
    applySnapshot,
    requestGanttFocus,
    handleGanttZoomDelta,
    resetGanttZoom,
    handleFileAction,
  } = useProgressProjectIO({
    apiBase,
    auth,
    authUid,
    org: {
      activePlan: org.activePlan,
      activeOrgId: org.activeOrgId,
    },

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

    projectStore,
    progressCalendar,

    ganttBarRef,
    ganttMeasureRef,

    ganttZoomLevels,
    ganttPxPerDay,
  });

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

      case "zoomReset":
        resetGanttZoom();
        return;

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
            onSetWorkWeekDays={(next) =>
              setProjectInfo((p) => ({ ...p, workWeekDays: next }))
            }
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
                          onColumnsChange={(nextCols: ColumnDef[]) => {
                            setAppColumns((prev) => {
                              const nextByKey = new Map(
                                nextCols.map((c) => [c.key, c])
                              );
                              const nextKeys = nextCols.map((c) => c.key);

                              const prevByKey = new Map(prev.map((c) => [c.key, c]));

                              const reorderedVisible = nextKeys
                                .map((key) => {
                                  const prevCol = prevByKey.get(key);
                                  const nextCol = nextByKey.get(key);
                                  if (!prevCol || !nextCol) return null;

                                  return {
                                    ...prevCol,
                                    width: nextCol.width ?? prevCol.width,
                                  } as ColumnDef;
                                })
                                .filter(Boolean) as ColumnDef[];

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

      <AppDatePickerPopover
        req={datePickReq as any}
        onRequestClose={closeDatePickerUI}
      />

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
