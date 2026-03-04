// src/progress/ProgressToolbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

type FileAction =
  | "newBlank"
  | "newFromTemplate"
  | "openProject"
  | "openFile"
  | "save"
  | "cloudOpen"
  | "cloudSaveUpdate"
  | "cloudSaveAsNew"
  | "saveAs"
  | "print"
  | "exportCsv"
  | "exportTsv"
  | "importTsv";

type TableAction =
  | "columnsManage"
  | "addRowEnd"
  | "addRowBelow"
  | "deleteSelectedRows";

type GanttAction =
  | "zoomIn"
  | "zoomOut"
  | "zoomReset"
  | "toggleWeekend"
  | "toggleTodayLine";

type CalendarAction = "calendarManage" | "setWorkWeek5" | "setWorkWeek6" | "setWorkWeek7";
type ProjectAction = "projectManage";

export type ProgressToolbarProps = {
  onFileAction?: (action: FileAction | { id: string; title?: string }) => void;
  onTableAction?: (action: TableAction) => void;
  onGanttAction?: (action: GanttAction) => void;
  onCalendarAction?: (action: CalendarAction) => void;
  onProjectAction?: (action: ProjectAction) => void;

  workWeekDays?: 5 | 6 | 7;
  onSetWorkWeekDays?: (next: 5 | 6 | 7) => void;

  ganttShowBarText?: boolean;
  onSetGanttShowBarText?: (next: boolean) => void;

  ganttDefaultBarColor?: string;
  onSetGanttDefaultBarColor?: (next: string) => void;

  activePlan?: "free" | "trial" | "pro";

  // Cloud state (optional, used to enforce safe Cloud Save behavior)
  cloudCurrentProjectId?: string | null;
  cloudSuggestedTitle?: string;

  disabled?: boolean;
  hasUnsavedChanges?: boolean;
  confirmOnNew?: boolean;
};

type MenuDivider = { kind: "divider" };

type MenuItemNode = {
  kind: "item";
  key: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  title?: string;
  action?: string;
  children?: MenuNode[];
};

type MenuCustomNode = {
  kind: "custom";
  key: string;
  render: () => React.ReactNode;
};

type MenuNode = MenuDivider | MenuItemNode | MenuCustomNode;

function useOutsideClose(
  rootRef: React.RefObject<HTMLElement>,
  open: boolean,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;

    const onDown = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey, true);

    return () => {
      window.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, onClose, rootRef]);
}

function MenuButton(props: {
  label: string;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className={`ptb-menu-btn ${props.open ? "is-open" : ""}`}
      onClick={props.onToggle}
      disabled={props.disabled}
      aria-haspopup="menu"
      aria-expanded={props.open}
    >
      <span className="ptb-menu-btn-label">{props.label}</span>
      <span className="ptb-menu-btn-caret">▾</span>
    </button>
  );
}

function Divider() {
  return <div className="ptb-menu-divider" role="separator" />;
}

function OverwriteConfirmModal(props: {
  open: boolean;
  title: string;
  text: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!props.open) return null;

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ptb-modal">
        <div className="ptb-modal-title">{props.title}</div>
        <div className="ptb-modal-text">{props.text}</div>

        <div className="ptb-modal-actions">
          <button
            type="button"
            className="ptb-btn ptb-btn--cancel"
            onClick={props.onCancel}
          >
            {props.cancelLabel}
          </button>
          <button
            type="button"
            className="ptb-btn ptb-btn--confirm"
            onClick={props.onConfirm}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function CloudSaveAsModal(props: {
  open: boolean;
  title: string;
  name: string;
  placeholder?: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  onChangeName: (next: string) => void;
}) {
  if (!props.open) return null;

  const canConfirm = props.name.trim().length > 0;

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ptb-modal">
        <div className="ptb-modal-title">{props.title}</div>

        <div className="ptb-modal-text" style={{ marginBottom: 10 }}>
          <input
            type="text"
            value={props.name}
            onChange={(e) => props.onChangeName(e.target.value)}
            placeholder={props.placeholder}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid var(--line)",
              background: "var(--panel)",
              color: "var(--text)",
              fontSize: 14,
              outline: "none",
            }}
          />
        </div>

        <div className="ptb-modal-actions">
          <button
            type="button"
            className="ptb-btn ptb-btn--cancel"
            onClick={props.onCancel}
          >
            {props.cancelLabel}
          </button>
          <button
            type="button"
            className="ptb-btn ptb-btn--confirm"
            onClick={props.onConfirm}
            disabled={!canConfirm}
            title={!canConfirm ? "Name is required" : undefined}
          >
            {props.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type OpenMenu = "file" | "cloud" | "table" | "gantt" | "calendar" | "project" | null;

export default function ProgressToolbar({
  onFileAction,
  onTableAction,
  onGanttAction,
  onCalendarAction,
  onProjectAction,

  workWeekDays = 5,
  onSetWorkWeekDays,

  ganttShowBarText = true,
  onSetGanttShowBarText,

  ganttDefaultBarColor = "#b98a3a",
  onSetGanttDefaultBarColor,

  activePlan = "free",
  cloudCurrentProjectId,
  cloudSuggestedTitle,
  disabled,
  hasUnsavedChanges,
  confirmOnNew = true,
}: ProgressToolbarProps) {
  const { t, lang } = useI18n();

  const isNo = String(lang || "no").toLowerCase().startsWith("no");
  const isPro = activePlan === "pro" || activePlan === "trial";
  const proOnlyText = isNo ? "Kun Pro / Trial" : "Pro / Trial only";

  const rootRef = useRef<HTMLDivElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [activeSubKey, setActiveSubKey] = useState<string | null>(null);

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);

  // Cloud: "Save as new" modal
  const [cloudSaveAsOpen, setCloudSaveAsOpen] = useState(false);
  const [cloudSaveAsName, setCloudSaveAsName] = useState("");

  const pendingNewActionRef = useRef<FileAction | null>(null);

  const anyOpen = openMenu !== null;

  useOutsideClose(rootRef, anyOpen, () => {
    setOpenMenu(null);
    setActiveSubKey(null);
  });

  const fileMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "newBlank",
        label: isNo ? "Nytt prosjekt" : "New project",
        hint: "Ctrl+N",
        action: "newBlank",
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "openProject",
        label: isNo ? "Åpne prosjekt…" : "Open project…",
        action: "openProject",
      },
      {
        kind: "item",
        key: "openFile",
        label: isNo ? "Åpne fil…" : "Open file…",
        hint: "Ctrl+O",
        action: "openFile",
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "save",
        label: isNo ? "Lagre lokalt" : "Save locally",
        hint: "Ctrl+S",
        action: "save",
      },

      {
        kind: "item",
        key: "saveAs",
        label: isNo ? "Lagre til fil…" : "Save to file…",
        action: "saveAs",
        disabled: !isPro,
        title: !isPro ? proOnlyText : undefined,
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "print",
        label: t("toolbar.file.print"),
        hint: "Ctrl+P",
        action: "print",
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "export",
        label: t("toolbar.file.export"),
        children: [
          {
            kind: "item",
            key: "exportTsv",
            label: "TSV…",
            action: "exportTsv",
            disabled: !isPro,
            title: !isPro ? proOnlyText : undefined,
          },
        ],
      },
      {
        kind: "item",
        key: "import",
        label: t("toolbar.file.import"),
        children: [
          {
            kind: "item",
            key: "importTsv",
            label: "TSV…",
            action: "importTsv",
            disabled: !isPro,
            title: !isPro ? proOnlyText : undefined,
          },
        ],
      },
    ],
    [t, isNo, isPro, proOnlyText]
  );

  const cloudMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "cloudOpen",
        label: isNo ? "Åpne…" : "Open…",
        action: "cloudOpen",
        disabled: !isPro,
        title: !isPro ? proOnlyText : undefined,
      },
      { kind: "divider" },
      {
        kind: "item",
        key: "cloudSaveUpdate",
        label: isNo ? "Lagre (oppdater aktivt)" : "Save (update active)",
        action: "cloudSaveUpdate",
        disabled: !isPro,
        title: !isPro
          ? proOnlyText
          : cloudCurrentProjectId
          ? isNo
            ? "Oppdaterer aktivt sky-prosjekt"
            : "Updates the active cloud project"
          : cloudCurrentProjectId === null
          ? isNo
            ? "Ingen aktiv sky-ID: lagrer som nytt i stedet"
            : "No active cloud id: saves as new instead"
          : isNo
          ? "Oppdaterer aktivt sky-prosjekt"
          : "Updates the active cloud project",
      },
      {
        kind: "item",
        key: "cloudSaveAsNew",
        label: isNo ? "Lagre som nytt…" : "Save as new…",
        action: "cloudSaveAsNew",
        disabled: !isPro,
        title: !isPro ? proOnlyText : undefined,
      },
    ],
    [isNo, isPro, proOnlyText, cloudCurrentProjectId]
  );

  const tableMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "columnsManage",
        label: t("toolbar.table.columns"),
        action: "columnsManage",
      },
      { kind: "divider" },
      {
        kind: "item",
        key: "addRowEnd",
        label: t("toolbar.table.addEnd"),
        action: "addRowEnd",
      },
      {
        kind: "item",
        key: "addRowBelow",
        label: t("toolbar.table.addBelow"),
        action: "addRowBelow",
      },
      {
        kind: "item",
        key: "deleteSelectedRows",
        label: t("toolbar.table.deleteSelected"),
        action: "deleteSelectedRows",
      },
    ],
    [t]
  );

  const ganttMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "zoomIn",
        label: t("toolbar.gantt.zoomIn"),
        action: "zoomIn",
      },
      {
        kind: "item",
        key: "zoomOut",
        label: t("toolbar.gantt.zoomOut"),
        action: "zoomOut",
      },
      {
        kind: "item",
        key: "zoomReset",
        label: t("toolbar.gantt.zoomReset"),
        action: "zoomReset",
      },
      { kind: "divider" },
      {
        kind: "item",
        key: "toggleWeekend",
        label: t("toolbar.gantt.toggleWeekend"),
        action: "toggleWeekend",
      },
      {
        kind: "custom",
        key: "toggleBarText",
        render: () => {
          const label = t("toolbar.gantt.toggleBarText");
          return (
            <div
              className="ptb-menu-item"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                userSelect: "none",
              }}
              role="menuitem"
              aria-label={label}
            >
              <span style={{ fontWeight: 700, fontSize: 12 }}>{label}</span>
              <input
                type="checkbox"
                checked={!!ganttShowBarText}
                onChange={(e) => onSetGanttShowBarText?.(e.target.checked)}
                disabled={disabled}
                style={{ width: 16, height: 16 }}
              />
            </div>
          );
        },
      },
      {
        kind: "item",
        key: "toggleTodayLine",
        label: t("toolbar.gantt.toggleTodayLine"),
        action: "toggleTodayLine",
      },
    ],
    [t, ganttShowBarText, onSetGanttShowBarText, disabled]
  );

  const calendarMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "calendarManage",
        label: t("toolbar.calendar.manage"),
        action: "calendarManage",
      },
      { kind: "divider" },
      {
        kind: "item",
        key: "workWeek",
        label: t("toolbar.calendar.workweek"),
        children: [
          {
            kind: "item",
            key: "setWorkWeek5",
            label: isNo ? "5 dager (Man–Fre)" : "5 days (Mon–Fri)",
            action: "setWorkWeek5",
          },
          {
            kind: "item",
            key: "setWorkWeek6",
            label: isNo ? "6 dager (Man–Lør)" : "6 days (Mon–Sat)",
            action: "setWorkWeek6",
          },
          {
            kind: "item",
            key: "setWorkWeek7",
            label: isNo ? "7 dager (Man–Søn)" : "7 days (Mon–Sun)",
            action: "setWorkWeek7",
          },
        ],
      },
    ],
    [t, isNo]
  );

  const projectMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "projectManage",
        label: t("toolbar.project.manage"),
        action: "projectManage",
      },
    ],
    [t]
  );

  const closeAll = () => {
    setOpenMenu(null);
    setActiveSubKey(null);
  };

  const openCloudSaveAs = (prefill?: string) => {
    const next = String(prefill ?? cloudSuggestedTitle ?? "").trim();
    setCloudSaveAsName(next);
    closeAll();
    setCloudSaveAsOpen(true);
  };

  const doFileAction = (a: FileAction) => {
    // Confirm before wiping current work
    if (a === "newBlank") {
      const shouldConfirm = confirmOnNew || !!hasUnsavedChanges;
      if (shouldConfirm) {
        pendingNewActionRef.current = a;
        setConfirmNewOpen(true);
        return;
      }
    }

    // Cloud: Save-as-new always opens a naming dialog.
    if (a === "cloudSaveAsNew") {
      openCloudSaveAs();
      return;
    }

    // Cloud: "Save (update active)" MUST NOT overwrite anything if there's no active cloud id.
    // If App passes cloudCurrentProjectId explicitly as null, we route to "Save as new" dialog.
    if (a === "cloudSaveUpdate" && cloudCurrentProjectId === null) {
      openCloudSaveAs();
      return;
    }

    closeAll();
    onFileAction?.(a);
  };

  const doTableAction = (a: TableAction) => {
    closeAll();
    onTableAction?.(a);
  };

  const doGanttAction = (a: GanttAction) => {
    closeAll();
    onGanttAction?.(a);
  };

  const doCalendarAction = (a: CalendarAction) => {
    if (a === "setWorkWeek5") {
      onSetWorkWeekDays?.(5);
      closeAll();
      return;
    }
    if (a === "setWorkWeek6") {
      onSetWorkWeekDays?.(6);
      closeAll();
      return;
    }
    if (a === "setWorkWeek7") {
      onSetWorkWeekDays?.(7);
      closeAll();
      return;
    }
    closeAll();
    onCalendarAction?.(a);
  };

  const doProjectAction = (a: ProjectAction) => {
    closeAll();
    onProjectAction?.(a);
  };

  const runFileAction = (a?: string) => {
    if (!a) return;
    doFileAction(a as FileAction);
  };
  const runTableAction = (a?: string) => {
    if (!a) return;
    doTableAction(a as TableAction);
  };
  const runGanttAction = (a?: string) => {
    if (!a) return;
    doGanttAction(a as GanttAction);
  };
  const runCalendarAction = (a?: string) => {
    if (!a) return;
    doCalendarAction(a as CalendarAction);
  };
  const runProjectAction = (a?: string) => {
    if (!a) return;
    doProjectAction(a as ProjectAction);
  };

  const cancelNew = () => {
    pendingNewActionRef.current = null;
    setConfirmNewOpen(false);
  };

  const cancelCloudSaveAs = () => {
    setCloudSaveAsOpen(false);
  };

  const confirmCloudSaveAs = () => {
    const name = cloudSaveAsName.trim();
    if (!name) return;
    setCloudSaveAsOpen(false);
    onFileAction?.({ id: "cloudSaveAsNew", title: name } as any);
  };

  useEffect(() => {
    if (!anyOpen) setActiveSubKey(null);
  }, [anyOpen]);

  const renderMenuPop = (
    menuLabel: string,
    nodes: MenuNode[],
    runAction: (a?: string) => void
  ) => (
    <div className="ptb-menu-pop" role="menu" aria-label={`${menuLabel}-meny`}>
      {nodes.map((node) => {
        if (node.kind === "divider") {
          return <Divider key={node.kind + "-" + Math.random()} />;
        }
        if (node.kind === "custom") {
          return <React.Fragment key={node.key}>{node.render()}</React.Fragment>;
        }

        const hasChildren = !!node.children?.length;

        const isOpen = activeSubKey === node.key;

        const onEnter = () => {
          if (!hasChildren) return;
          setActiveSubKey(node.key);
        };

        const onLeave = () => {
          if (!hasChildren) return;
          setActiveSubKey((k) => (k === node.key ? null : k));
        };

        const onClick = () => {
          if (node.disabled) return;
          if (hasChildren) {
            setActiveSubKey((k) => (k === node.key ? null : node.key));
            return;
          }
          runAction(node.action);
        };

        return (
          <div
            key={node.key}
            className={`ptb-menu-item ${node.disabled ? "is-disabled" : ""}`}
            role="menuitem"
            title={node.title}
            onMouseEnter={onEnter}
            onMouseLeave={onLeave}
            onClick={onClick}
            aria-disabled={node.disabled ? "true" : "false"}
            style={{ position: "relative" }}
          >
            <span className="ptb-menu-item-label">{node.label}</span>
            <span className="ptb-menu-item-right">
              {node.hint ? <span className="ptb-menu-item-hint">{node.hint}</span> : null}
              {hasChildren ? <span className="ptb-menu-item-caret">▸</span> : null}
            </span>

            {hasChildren && isOpen ? (
              <div className="ptb-submenu" role="menu">
                {node.children!.map((child) => {
                  if (child.kind === "divider") return <Divider key={"d-" + Math.random()} />;
                  if (child.kind === "custom") return <React.Fragment key={child.key}>{child.render()}</React.Fragment>;

                  const onChildClick = () => {
                    if (child.disabled) return;
                    runAction(child.action);
                  };

                  return (
                    <div
                      key={child.key}
                      className={`ptb-menu-item ${child.disabled ? "is-disabled" : ""}`}
                      role="menuitem"
                      title={child.title}
                      onClick={onChildClick}
                      aria-disabled={child.disabled ? "true" : "false"}
                    >
                      <span className="ptb-menu-item-label">{child.label}</span>
                      <span className="ptb-menu-item-right">
                        {child.hint ? <span className="ptb-menu-item-hint">{child.hint}</span> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );

  const confirmNew = () => {
    const a = pendingNewActionRef.current;
    pendingNewActionRef.current = null;
    setConfirmNewOpen(false);
    if (!a) return;
    closeAll();
    onFileAction?.(a);
  };

  const fileOpen = openMenu === "file";
  const cloudOpen = openMenu === "cloud";
  const tableOpen = openMenu === "table";
  const ganttOpen = openMenu === "gantt";
  const calendarOpen = openMenu === "calendar";
  const projectOpen = openMenu === "project";

  return (
    <div className="ptb-root" ref={rootRef}>
      <div className="ptb-left">
        <div className="ptb-menu">
          <MenuButton
            label={t("toolbar.top.file")}
            open={fileOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "file" ? null : "file"));
            }}
          />
          {fileOpen ? renderMenuPop(t("toolbar.top.file"), fileMenu, runFileAction) : null}
        </div>

        <div className="ptb-menu">
          <MenuButton
            label={isNo ? "Sky" : "Cloud"}
            open={cloudOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "cloud" ? null : "cloud"));
            }}
          />
          {cloudOpen ? renderMenuPop(isNo ? "Sky" : "Cloud", cloudMenu, runFileAction) : null}
        </div>

        <div className="ptb-menu">
          <MenuButton
            label={t("toolbar.top.table")}
            open={tableOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "table" ? null : "table"));
            }}
          />
          {tableOpen ? renderMenuPop(t("toolbar.top.table"), tableMenu, runTableAction) : null}
        </div>

        <div className="ptb-menu">
          <MenuButton
            label={t("toolbar.top.gantt")}
            open={ganttOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "gantt" ? null : "gantt"));
            }}
          />
          {ganttOpen ? renderMenuPop(t("toolbar.top.gantt"), ganttMenu, runGanttAction) : null}
        </div>

        <div className="ptb-menu">
          <MenuButton
            label={t("toolbar.top.calendar")}
            open={calendarOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "calendar" ? null : "calendar"));
            }}
          />
          {calendarOpen ? renderMenuPop(t("toolbar.top.calendar"), calendarMenu, runCalendarAction) : null}
        </div>

        <div className="ptb-menu">
          <MenuButton
            label={t("toolbar.top.project")}
            open={projectOpen}
            disabled={disabled}
            onToggle={() => {
              setActiveSubKey(null);
              setOpenMenu((v) => (v === "project" ? null : "project"));
            }}
          />
          {projectOpen ? renderMenuPop(t("toolbar.top.project"), projectMenu, runProjectAction) : null}
        </div>
      </div>

      <div className="ptb-right" />

      <CloudSaveAsModal
        open={cloudSaveAsOpen}
        title={isNo ? "Lagre som nytt" : "Save as new"}
        name={cloudSaveAsName}
        placeholder={isNo ? "Prosjektnavn" : "Project name"}
        cancelLabel={isNo ? "Avbryt" : "Cancel"}
        confirmLabel={isNo ? "Lagre" : "Save"}
        onCancel={cancelCloudSaveAs}
        onConfirm={confirmCloudSaveAs}
        onChangeName={setCloudSaveAsName}
      />

      <OverwriteConfirmModal
        open={confirmNewOpen}
        title={t("toolbar.confirmOverwrite.title")}
        text={t("toolbar.confirmOverwrite.text")}
        cancelLabel={t("toolbar.confirmOverwrite.cancel")}
        confirmLabel={t("toolbar.confirmOverwrite.confirm")}
        onCancel={cancelNew}
        onConfirm={confirmNew}
      />
    </div>
  );
}
