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
import Modal from "./components/Modal";

import GanttView from "./progress/GanttView";
import CalendarView from "./progress/CalendarView";
import PricingView from "./progress/PricingView";
import PrintSettingsView from "./progress/PrintSettingsView";
import PrintView from "./progress/PrintView";
import LicenseView from "./progress/LicenseView";
import ProjectLibraryModal from "./progress/ProjectLibraryModal";
import ColumnManagerModal from "./progress/ColumnManagerModal";

import {
  lsRead,
  lsWrite,
  lsReadBool,
  lsWriteBool,
  lsReadNumber,
  lsWriteNumber,
} from "./core/utils/localStorage";
import { sleep } from "./core/utils/sleep";
import { useOrgContext } from "./progress/cloud/useOrgContext";

import { useDatePickerPopover } from "./progress/app/useDatePickerPopover";
import { useProgressProjectIO } from "./progress/app/useProgressProjectIO";
import { useProgressRowEditing } from "./progress/app/useProgressRowEditing";

import {
  ensureAtLeastTitleVisible,
  applyColumnsToRows,
  ensureTableCoreColumns,
} from "./progress/columns";
import type { AppColumnSpec } from "./progress/columns";
import { addCustomColumn } from "./progress/columns";
import type { ProjectInfo } from "./progress/types";
import type { CalendarEntry } from "./progress/types";

import {
  addRowAtEnd,
  addRowBelowSelection,
  deleteSelectedRows,
} from "./progress/tableCommands";

import {
  computeDerivedRows,
  computeDependencies,
  defaultCalendar,
} from "./progress/ProgressCore";

import AppDatePickerPopover, {
  type DatePickerRequest,
} from "./progress/AppDatePickerPopover";

import { safeParseJSON, downloadTextFile, pickTextFile } from "./core/utils/fileIO";
import { useBottomHScrollVar } from "./core/utils/useBottomHScrollVar";
import {
  addDays,
  addMonths,
  diffDays,
  getProjectSpanFromRows,
  computeGanttMinForSpan,
  clamp01to100,
} from "./progress/ganttDateUtils";
import { recomputeAllRows } from "./progress/autoSchedule";
import {
  DurationAdjustPopover,
  WeekendAdjustPopover,
} from "./progress/AdjustPopovers";

import { parseClipboard, toTSV } from "./core/utils/clipboard";
import { useI18n } from "./i18n";
import { LINKS } from "./config/links";

import "./styles/mcl-theme.css";
import "./styles/appshell.css";
import "./styles/header.css";
import "./styles/toolbar.css";
import "./styles/modal.css";
import "./styles/help.css";
import "./styles/progress.css";
// ============================
// BLOCK: IMPORTS (END)
// ============================

// ============================
// BLOCK: CONSTANTS (START)
// ============================
const PROGRESS_KEYS = {
  view: "mcl.progress.view",
  splitLeft: "mcl.progress.splitLeft",
  ganttZoomIdx: "mcl.progress.ganttZoomIdx",
  ganttWeekendShade: "mcl.progress.ganttWeekendShade",
  ganttTodayLine: "mcl.progress.ganttTodayLine",

  appColumns: "mcl.progress.columns",
  projectInfo: "mcl.progress.projectInfo",
  calendarEntries: "mcl.progress.calendarEntries",
  printSettings: "mcl.progress.printSettings",
  licenseEmail: "mcl.progress.licenseEmail",
  licenseKey: "mcl.progress.licenseKey",
} as const;

type ViewKey =
  | "progress"
  | "calendar"
  | "pricing"
  | "printSettings"
  | "print"
  | "license";

type PrintSettings = {
  paper: "a4" | "a3";
  orientation: "portrait" | "landscape";
  showOwners: boolean;
  showDeps: boolean;
  showWbs: boolean;
};

const DEFAULT_PRINT_SETTINGS: PrintSettings = {
  paper: "a4",
  orientation: "landscape",
  showOwners: true,
  showDeps: true,
  showWbs: true,
};
// ============================
// BLOCK: CONSTANTS (END)
// ============================

// ============================
// BLOCK: HELPERS (START)
// ============================
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizePrintSettings(x: any): PrintSettings {
  const paper = x?.paper === "a3" ? "a3" : "a4";
  const orientation = x?.orientation === "portrait" ? "portrait" : "landscape";
  return {
    paper,
    orientation,
    showOwners: Boolean(x?.showOwners ?? true),
    showDeps: Boolean(x?.showDeps ?? true),
    showWbs: Boolean(x?.showWbs ?? true),
  };
}
// ============================
// BLOCK: HELPERS (END)
// ============================

export default function App() {
  const { t } = useI18n();

  // ============================
  // BLOCK: ORG / LICENSE (START)
  // ============================
  const org = useOrgContext();

  const [licenseEmail, setLicenseEmail] = useState<string>(() =>
    lsRead(PROGRESS_KEYS.licenseEmail, "")
  );
  const [licenseKey, setLicenseKey] = useState<string>(() =>
    lsRead(PROGRESS_KEYS.licenseKey, "")
  );

  useEffect(() => {
    lsWrite(PROGRESS_KEYS.licenseEmail, licenseEmail);
  }, [licenseEmail]);
  useEffect(() => {
    lsWrite(PROGRESS_KEYS.licenseKey, licenseKey);
  }, [licenseKey]);
  // ============================
  // BLOCK: ORG / LICENSE (END)
  // ============================

  // ============================
  // BLOCK: VIEW STATE (START)
  // ============================
  const [view, setView] = useState<ViewKey>(() =>
    (lsRead(PROGRESS_KEYS.view, "progress") as ViewKey) || "progress"
  );
  useEffect(() => {
    lsWrite(PROGRESS_KEYS.view, view);
  }, [view]);
  // ============================
  // BLOCK: VIEW STATE (END)
  // ============================

  // ============================
  // BLOCK: COLUMNS + ROWS (START)
  // ============================
  const [appColumns, setAppColumns] = useState<ColumnDef[]>(() => {
    const raw = safeParseJSON(lsRead(PROGRESS_KEYS.appColumns, "null"));
    if (raw && Array.isArray(raw)) {
      return ensureAtLeastTitleVisible(ensureTableCoreColumns(raw as any));
    }
    return ensureAtLeastTitleVisible(ensureTableCoreColumns([]));
  });

  useEffect(() => {
    lsWrite(PROGRESS_KEYS.appColumns, JSON.stringify(appColumns));
  }, [appColumns]);

  const [rows, setRows] = useState<RowData[]>(() => {
    const raw = safeParseJSON(lsRead("mcl.progress.rows", "null"));
    if (raw && Array.isArray(raw)) return raw as any;
    return [];
  });

  useEffect(() => {
    lsWrite("mcl.progress.rows", JSON.stringify(rows));
  }, [rows]);
  // ============================
  // BLOCK: COLUMNS + ROWS (END)
  // ============================

  // ============================
  // BLOCK: PROJECT INFO + CALENDAR (START)
  // ============================
  const [projectInfo, setProjectInfo] = useState<ProjectInfo>(() =>
    safeParse<ProjectInfo>(lsRead(PROGRESS_KEYS.projectInfo, null), {
      title: t("app.defaults.projectTitle"),
      owners: [],
      workWeekDays: 5,
    } as any)
  );

  useEffect(() => {
    lsWrite(PROGRESS_KEYS.projectInfo, JSON.stringify(projectInfo));
  }, [projectInfo]);

  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(() =>
    safeParse<CalendarEntry[]>(lsRead(PROGRESS_KEYS.calendarEntries, null), [])
  );
  useEffect(() => {
    lsWrite(PROGRESS_KEYS.calendarEntries, JSON.stringify(calendarEntries));
  }, [calendarEntries]);

  // owners -> list
  const ownersList = useMemo(() => {
    const raw = (projectInfo as any)?.owners ?? [];
    const seen = new Set<string>();
    const unique: string[] = [];
    if (!Array.isArray(raw)) return unique;

    for (const x of raw) {
      const n =
        typeof x === "string"
          ? x.trim()
          : typeof x === "object" && x
          ? String((x as any).name ?? "").trim()
          : "";
      if (!n) continue;
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

  const ganttPxPerDay = ganttZoomLevels[ganttZoomIdx] ?? 24;

  const ganttMinDate = useMemo(() => {
    const span = getProjectSpanFromRows(rows, progressCalendar);
    return computeGanttMinForSpan(span);
  }, [rows, progressCalendar]);

  const derived = useMemo(() => {
    return computeDerivedRows(rows, progressCalendar, {
      wbsKey: "wbs",
      depKey: "dep",
      startKey: "start",
      endKey: "end",
      durKey: "dur",
      ownerKey: "owner",
      titleKey: "title",
    });
  }, [rows, progressCalendar]);

  // Keep rows “clean” if derived engine wants to normalize something
  useEffect(() => {
    setRows((prev) => recomputeAllRows(prev, progressCalendar, null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progressCalendar]);
  // ============================
  // BLOCK: PROJECT INFO + CALENDAR (END)
  // ============================

  // ============================
  // BLOCK: SELECTION (START)
  // ============================
  const [selection, setSelection] = useState<Selection | null>(null);
  // ============================
  // BLOCK: SELECTION (END)
  // ============================

  // ============================
  // BLOCK: SPLIT_STATE (START)
  // ============================
  const [splitLeft, setSplitLeft] = useState<number>(() =>
    lsReadNumber(PROGRESS_KEYS.splitLeft, 60, { min: 0, max: 100 })
  );
  useEffect(() => {
    lsWriteNumber(PROGRESS_KEYS.splitLeft, splitLeft);
  }, [splitLeft]);
  // ============================
  // BLOCK: SPLIT_STATE (END)
  // ============================

  // ============================
  // BLOCK: SPLIT_STATE_HANDLERS (START)
  // ============================
  const onDividerPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const startX = e.clientX;
    const startSplit = splitLeft;

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      const pct = (dx / window.innerWidth) * 100;
      setSplitLeft(() => clamp01to100(startSplit + pct));
    };

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
  // BLOCK: DURATION + WEEKEND FLOW (END)
  // ============================

  const { datePickReq, closeDatePickerUI, onRequestDatePicker } =
    useDatePickerPopover();

  // ============================
  // BLOCK: COLUMN MANAGER MODAL (START)
  // ============================
  const [colMgrOpen, setColMgrOpen] = useState(false);
  // ============================
  // BLOCK: COLUMN MANAGER MODAL (END)
  // ============================

  // ============================
  // BLOCK: PROJECT LIBRARY MODAL (START)
  // ============================
  const [projectLibraryOpen, setProjectLibraryOpen] = useState(false);
  // ============================
  // BLOCK: PROJECT LIBRARY MODAL (END)
  // ============================

  // ============================
  // BLOCK: HELP PANEL (START)
  // ============================
  const [helpOpen, setHelpOpen] = useState(false);
  // ============================
  // BLOCK: HELP PANEL (END)
  // ============================

  // ============================
  // BLOCK: PRINT SETTINGS (START)
  // ============================
  const [printSettings, setPrintSettings] = useState<PrintSettings>(() =>
    normalizePrintSettings(
      safeParseJSON(lsRead(PROGRESS_KEYS.printSettings, "null")) ?? DEFAULT_PRINT_SETTINGS
    )
  );
  useEffect(() => {
    lsWrite(PROGRESS_KEYS.printSettings, JSON.stringify(printSettings));
  }, [printSettings]);
  // ============================
  // BLOCK: PRINT SETTINGS (END)
  // ============================

  // ============================
  // BLOCK: GANTT SCROLLBAR SUPPORT (START)
  // ============================
  const ganttBarRef = useRef<HTMLDivElement | null>(null);
  const ganttSpacerRef = useRef<HTMLDivElement | null>(null);

  useBottomHScrollVar({
    barRef: ganttBarRef,
    spacerRef: ganttSpacerRef,
    deps: [derived.rows.length, ganttPxPerDay],
  });
  // ============================
  // BLOCK: GANTT SCROLLBAR SUPPORT (END)
  // ============================

  // ============================
  // BLOCK: PROJECT IO (START)
  // ============================
  const {
    buildSnapshot,
    applySnapshot,
    saveToCloudProOnly,
    requestGanttFocus,
    handleGanttZoomDelta,
    handleFileAction,
  } = useProgressProjectIO({
    rows,
    setRows,
    appColumns,
    setAppColumns,
    projectInfo,
    setProjectInfo,
    calendarEntries,
    setCalendarEntries,
    progressCalendar,
    ganttZoomIdx,
    setGanttZoomIdx,
    ganttZoomLevels,
    ganttPxPerDay,
  });
  // ============================
  // BLOCK: PROJECT IO (END)
  // ============================

  const resetGanttZoom = () => {
    setGanttZoomIdx(11);
  };

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
      case "addHoliday":
        setCalendarEntries((prev) => [
          ...prev,
          { from: "", to: "", label: "" } as any,
        ]);
        return;

      default:
        console.warn("[Progress] Unknown calendar action:", a, action);
        return;
    }
  };

  const handleToolbarAction = async (action: any) => {
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
      case "help":
        setHelpOpen(true);
        return;

      case "columns":
        setColMgrOpen(true);
        return;

      case "projectLibrary":
        setProjectLibraryOpen(true);
        return;

      case "addRowEnd":
        setRows((prev) => addRowAtEnd(prev, appColumns));
        return;

      case "addRowBelow":
        setRows((prev) => addRowBelowSelection(prev, appColumns, selection));
        return;

      case "deleteRows":
        setRows((prev) => deleteSelectedRows(prev, selection));
        return;

      case "fileNew":
      case "fileOpenLocal":
      case "fileSaveLocal":
      case "fileSaveAsLocal":
      case "fileSaveCloud":
      case "fileOpenCloud":
      case "cloudOpen":
      case "cloudSaveUpdate":
        await handleFileAction(a);
        return;

      default:
        console.warn("[Progress] Unknown toolbar action:", a, action);
        return;
    }
  };

  // ============================
  // BLOCK: TABLE DATE PICKER PREVIEW (START)
  // ============================
  const [datePreview, setDatePreview] = useState<TableCoreDatePreview | null>(null);

  const handleDatePreview = useCallback((p: TableCoreDatePreview | null) => {
    setDatePreview(p);
  }, []);
  // ============================
  // BLOCK: TABLE DATE PICKER PREVIEW (END)
  // ============================

  // ============================
  // BLOCK: RENDER (START)
  // ============================
  return (
    <div className="appshell-root">
      <Header
        title={t("app.title")}
        subtitle={t("app.subtitle")}
        onAction={handleToolbarAction}
      />

      <Toolbar
        view={view}
        onChangeView={setView}
        onAction={handleToolbarAction}
      />

      <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />

      <Modal
        open={view === "license"}
        title={t("license.title")}
        onClose={() => setView("progress")}
      >
        <LicenseView
          org={org}
          licenseEmail={licenseEmail}
          setLicenseEmail={setLicenseEmail}
          licenseKey={licenseKey}
          setLicenseKey={setLicenseKey}
          onDone={() => setView("progress")}
        />
      </Modal>

      <main className="progress-main">
        {view === "pricing" ? (
          <PricingView />
        ) : view === "printSettings" ? (
          <PrintSettingsView
            settings={printSettings}
            onChange={setPrintSettings}
            onGoPrint={() => setView("print")}
          />
        ) : view === "print" ? (
          <PrintView
            rows={derived.rows}
            columns={appColumns}
            projectInfo={projectInfo}
            calendar={progressCalendar}
            deps={deps}
            ownerColorMap={ownerColorMap}
            printSettings={printSettings}
          />
        ) : view === "calendar" ? (
          <CalendarView
            entries={calendarEntries}
            onChange={setCalendarEntries}
            onAction={handleCalendarAction}
          />
        ) : (
          <section className="split-layout">
            <div
              className="split-left"
              style={{ width: `${splitLeft}%` }}
            >
              <TableCore
                columns={appColumns}
                rows={derived.rows}
                selection={selection}
                onSelectionChange={setSelection}
                onRowsChange={onRowsChange}
                onCellCommit={onCellCommit}
                onRequestDatePicker={(req: DatePickerRequest) => {
                  onRequestDatePicker(req);
                }}
                onDatePreview={handleDatePreview}
                datePreview={datePreview}
                onColumnsChange={(nextCols: ColumnDef[]) => {
                  setAppColumns((prev) => {
                    const nextByKey = new Map(nextCols.map((c) => [c.key, c]));
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
                        };
                      })
                      .filter(Boolean) as ColumnDef[];

                    const hidden = prev.filter((c) => !nextByKey.has(c.key));

                    return [...reorderedVisible, ...hidden];
                  });
                }}
              />
            </div>

            <div
              className="split-divider"
              role="separator"
              tabIndex={0}
              aria-valuenow={splitLeft}
              aria-valuemin={0}
              aria-valuemax={100}
              onPointerDown={onDividerPointerDown}
              onKeyDown={onDividerKeyDown}
            >
              <div className="split-divider-handle" />
            </div>

            <div
              className="split-right"
              style={{ width: `${100 - splitLeft}%` }}
            >
              <div className="split-right-inner">
                <GanttView
                  rows={derived.rows}
                  columns={appColumns}
                  ganttMinDate={ganttMinDate}
                  pxPerDay={ganttPxPerDay}
                  showWeekendShade={ganttWeekendShade}
                  showTodayLine={ganttTodayLine}
                  deps={deps}
                  ownerColorMap={ownerColorMap}
                  onAction={handleGanttAction}
                  onRequestFocus={requestGanttFocus}
                />

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
          </section>
        )}
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

      <ProjectLibraryModal
        open={projectLibraryOpen}
        org={org}
        onClose={() => setProjectLibraryOpen(false)}
        onOpenSnapshot={(snap) => {
          applySnapshot(snap);
          setProjectLibraryOpen(false);
          setView("progress");
        }}
        onSaveSnapshot={async () => {
          await saveToCloudProOnly();
        }}
      />
    </div>
  );
  // ============================
  // BLOCK: RENDER (END)
  // ============================
}
