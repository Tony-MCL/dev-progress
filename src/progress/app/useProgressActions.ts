// ===============================
// src/progress/app/useProgressActions.ts
// ===============================
import { useCallback } from "react";
import type { RowData, Selection } from "../../core/TableTypes";
import type { AppColumnDef } from "../tableCommands";
import {
  ensureAtLeastTitleVisible,
  applyColumnsToRows,
  addRowAtEnd,
  addRowBelowSelection,
  deleteSelectedRows,
} from "../tableCommands";

type ParseActionResult = string;

function parseActionId(action: any): ParseActionResult {
  if (typeof action === "string") return action;
  if (typeof action === "object" && action) {
    return String(action.id ?? action.action ?? action.key ?? "");
  }
  return "";
}

type ProjectRecordLike = { id: string; snapshot: any };

type Args = {
  // org/plan
  activePlan: string | null | undefined;

  // table state
  rows: RowData[];
  selection: Selection | null;
  appColumns: AppColumnDef[];
  setAppColumns: React.Dispatch<React.SetStateAction<AppColumnDef[]>>;

  // table update pipeline
  onRowsChange: (next: RowData[]) => void;

  // gantt controls
  handleGanttZoomDelta: (step: number, anchorX: number | null) => void;
  resetGanttZoom: () => void;
  setGanttWeekendShade: React.Dispatch<React.SetStateAction<boolean>>;
  setGanttTodayLine: React.Dispatch<React.SetStateAction<boolean>>;

  // open/close modals
  setColMgrOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setCalendarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProjectLibraryOpen: React.Dispatch<React.SetStateAction<boolean>>;

  // openProject (free/pro split)
  openFreeProject: () => boolean; // returns true if it loaded a project
  startNewBlankProject: () => void; // used when free has no project to open
};

export function useProgressActions({
  activePlan,

  rows,
  selection,
  appColumns,
  setAppColumns,

  onRowsChange,

  handleGanttZoomDelta,
  resetGanttZoom,
  setGanttWeekendShade,
  setGanttTodayLine,

  setColMgrOpen,
  setCalendarOpen,
  setProjectOpen,
  setProjectLibraryOpen,

  openFreeProject,
  startNewBlankProject,
}: Args) {
  const handleGanttAction = useCallback(
    (action: any) => {
      const a = parseActionId(action);

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
    },
    [
      handleGanttZoomDelta,
      resetGanttZoom,
      setGanttWeekendShade,
      setGanttTodayLine,
    ]
  );

  const handleCalendarAction = useCallback(
    (action: any) => {
      const a = parseActionId(action);

      switch (a) {
        case "calendarManage":
          setCalendarOpen(true);
          return;

        default:
          console.warn("[Progress] Unknown calendar action:", a, action);
          return;
      }
    },
    [setCalendarOpen]
  );

  const handleProjectAction = useCallback(
    (action: any) => {
      const a = parseActionId(action);

      switch (a) {
        case "projectManage":
          setProjectOpen(true);
          return;

        case "openProject": {
          const plan = String(activePlan ?? "free");
          const isPro = plan === "pro" || plan === "trial";

          if (isPro) {
            setProjectLibraryOpen(true);
            return;
          }

          const ok = openFreeProject();
          if (ok) return;

          startNewBlankProject();
          return;
        }

        default:
          console.warn("[Progress] Unknown project action:", a, action);
          return;
      }
    },
    [
      activePlan,
      openFreeProject,
      setProjectLibraryOpen,
      setProjectOpen,
      startNewBlankProject,
    ]
  );

  const handleTableAction = useCallback(
    (action: any) => {
      const a = parseActionId(action);

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
    },
    [appColumns, onRowsChange, rows, selection, setAppColumns, setColMgrOpen]
  );

  return {
    handleGanttAction,
    handleCalendarAction,
    handleProjectAction,
    handleTableAction,
  };
}
