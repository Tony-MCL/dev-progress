// src/progress/ProgressToolbar.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";

type FileAction =
  | "newBlank"
  | "newFromTemplate"
  | "openProject"
  | "openFile"
  | "save"
  | "saveCloud"
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

type CalendarAction =
  | "calendarManage"
  | "setWorkWeek5"
  | "setWorkWeek6"
  | "setWorkWeek7";
type ProjectAction = "projectManage";

export type ProgressToolbarProps = {
  onFileAction?: (action: FileAction) => void;
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
      const root = rootRef.current;
      if (!root) return;
      if (!root.contains(e.target as any)) onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
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
      className={"ptb-top-btn" + (props.open ? " ptb-top-btn--open" : "")}
      onClick={props.onToggle}
      disabled={props.disabled}
      aria-haspopup="menu"
      aria-expanded={props.open}
    >
      {props.label} <span className="ptb-caret">▾</span>
    </button>
  );
}

function MenuItem(props: {
  label: string;
  hint?: string;
  disabled?: boolean;
  title?: string;
  hasChildren?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="ptb-menu-item"
      onClick={props.onClick}
      disabled={props.disabled}
      title={props.title}
      role="menuitem"
      aria-haspopup={props.hasChildren ? "menu" : undefined}
    >
      <span className="ptb-menu-item-label">{props.label}</span>
      <span className="ptb-menu-item-right">
        {props.hint ? (
          <span className="ptb-menu-item-hint">{props.hint}</span>
        ) : null}
        {props.hasChildren ? (
          <span className="ptb-menu-item-arrow">▸</span>
        ) : null}
      </span>
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

type OpenMenu = "file" | "table" | "gantt" | "calendar" | "project" | null;

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
  disabled = false,
  hasUnsavedChanges = false,
  confirmOnNew = true,
}: ProgressToolbarProps) {
  const { t, lang } = useI18n();
  const isNo = String(lang || "no").toLowerCase().startsWith("no");

  const rootRef = useRef<HTMLDivElement>(null);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [activeSubKey, setActiveSubKey] = useState<string | null>(null);

  const fileOpen = openMenu === "file";
  const tableOpen = openMenu === "table";
  const ganttOpen = openMenu === "gantt";
  const calendarOpen = openMenu === "calendar";
  const projectOpen = openMenu === "project";

  const anyOpen = fileOpen || tableOpen || ganttOpen || calendarOpen || projectOpen;

  useOutsideClose(rootRef, anyOpen, () => setOpenMenu(null));

  // Confirm overwrite modal
  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
  const pendingNewActionRef = useRef<FileAction | null>(null);

  const fileMenu: MenuNode[] = useMemo(() => {
    const isPro = activePlan === "pro" || activePlan === "trial";

    return [
      {
        kind: "item",
        key: "newBlank",
        label: t("toolbar.file.newBlank"),
        hint: "Ctrl+N",
        action: "newBlank",
      },

      {
        kind: "item",
        key: "openProject",
        label: t("toolbar.file.openProject"),
        action: "openProject",
      },

      {
        kind: "item",
        key: "openFile",
        label: t("toolbar.file.openFile"),
        hint: "Ctrl+O",
        action: "openFile",
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "save",
        label: t("toolbar.file.save"),
        hint: "Ctrl+S",
        action: "save",
      },

      ...(isPro
        ? [
            {
              kind: "item" as const,
              key: "saveAs",
              label: t("toolbar.file.saveAs"),
              action: "saveAs",
            },
          ]
        : [
            // keep structure stable
            {
              kind: "item" as const,
              key: "saveAs",
              label: t("toolbar.file.saveAs"),
              disabled: true,
              action: "saveAs",
            },
          ]),

      ...(isPro
        ? [
            {
              kind: "item" as const,
              key: "saveCloud",
              label: t("toolbar.file.saveCloud"),
              action: "saveCloud",
            },
          ]
        : []),

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
            key: "exportCsv",
            label: t("toolbar.file.exportCsv"),
            action: "exportCsv",
          },
          {
            kind: "item",
            key: "exportTsv",
            label: t("toolbar.file.exportTsv"),
            action: "exportTsv",
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
            label: t("toolbar.file.importTsv"),
            action: "importTsv",
          },
        ],
      },
    ];
  }, [activePlan, t]);

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
        label: t("toolbar.table.addRowEnd"),
        action: "addRowEnd",
      },
      {
        kind: "item",
        key: "addRowBelow",
        label: t("toolbar.table.addRowBelow"),
        action: "addRowBelow",
      },
      {
        kind: "item",
        key: "deleteSelectedRows",
        label: t("toolbar.table.deleteSelectedRows"),
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
        kind: "item",
        key: "toggleTodayLine",
        label: t("toolbar.gantt.toggleTodayLine"),
        action: "toggleTodayLine",
      },

      { kind: "divider" },

      {
        kind: "custom",
        key: "barText",
        render: () => (
          <div className="ptb-menu-custom">
            <label className="ptb-check">
              <input
                type="checkbox"
                checked={!!ganttShowBarText}
                onChange={(e) => onSetGanttShowBarText?.(e.target.checked)}
              />
              <span>{t("toolbar.gantt.showBarText")}</span>
            </label>
          </div>
        ),
      },

      {
        kind: "custom",
        key: "barColor",
        render: () => (
          <div className="ptb-menu-custom">
            <div className="ptb-color-row">
              <span className="ptb-color-label">{t("toolbar.gantt.defaultBarColor")}</span>
              <input
                type="color"
                className="ptb-color"
                value={ganttDefaultBarColor || "#b98a3a"}
                onChange={(e) => onSetGanttDefaultBarColor?.(e.target.value)}
              />
            </div>
          </div>
        ),
      },
    ],
    [t, ganttShowBarText, onSetGanttShowBarText, ganttDefaultBarColor, onSetGanttDefaultBarColor]
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
        label: isNo ? "Arbeidsuke" : "Work week",
        children: [
          {
            kind: "item",
            key: "workWeek5",
            label: isNo ? "5 dager (man–fre)" : "5 days (Mon–Fri)",
            hint: workWeekDays === 5 ? "✓" : undefined,
            action: "setWorkWeek5",
          },
          {
            kind: "item",
            key: "workWeek6",
            label: isNo ? "6 dager (man–lør)" : "6 days (Mon–Sat)",
            hint: workWeekDays === 6 ? "✓" : undefined,
            action: "setWorkWeek6",
          },
          {
            kind: "item",
            key: "workWeek7",
            label: isNo ? "7 dager (man–søn)" : "7 days (Mon–Sun)",
            hint: workWeekDays === 7 ? "✓" : undefined,
            action: "setWorkWeek7",
          },
        ],
      },
    ],
    [t, isNo, workWeekDays]
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

  const needsOverwriteConfirm = (a: FileAction) => {
    // Actions that replace the current plan / project content
    const destructive: FileAction[] = [
      "newBlank",
      "newFromTemplate",
      "openProject",
      "openFile",
      "importTsv",
    ];
    return destructive.includes(a);
  };

  const doFileAction = (a: FileAction) => {
    const shouldConfirm =
      (confirmOnNew || !!hasUnsavedChanges) && needsOverwriteConfirm(a);
    if (shouldConfirm) {
      pendingNewActionRef.current = a;
      setConfirmNewOpen(true);
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

  const confirmNew = () => {
    const a = pendingNewActionRef.current;
    pendingNewActionRef.current = null;
    setConfirmNewOpen(false);
    closeAll();
    if (a) onFileAction?.(a);
  };

  const cancelNew = () => {
    pendingNewActionRef.current = null;
    setConfirmNewOpen(false);
  };

  useEffect(() => {
    if (!anyOpen) setActiveSubKey(null);
  }, [anyOpen]);

  const renderMenuPop = (title: string, nodes: MenuNode[], run: (a?: string) => void) => {
    const renderNode = (n: MenuNode) => {
      if (n.kind === "divider") return <Divider key={Math.random()} />;

      if (n.kind === "custom") {
        return (
          <div key={n.key} className="ptb-menu-custom-wrap">
            {n.render()}
          </div>
        );
      }

      const hasChildren = !!n.children && n.children.length > 0;
      const subOpen = activeSubKey === n.key;

      return (
        <div key={n.key} className="ptb-menu-row">
          <MenuItem
            label={n.label}
            hint={n.hint}
            disabled={n.disabled}
            title={n.title}
            hasChildren={hasChildren}
            onClick={() => {
              if (n.disabled) return;
              if (hasChildren) {
                setActiveSubKey((v) => (v === n.key ? null : n.key));
                return;
              }
              run(n.action);
            }}
          />

          {hasChildren && subOpen ? (
            <div className="ptb-submenu" role="menu" aria-label={n.label}>
              {n.children!.map(renderNode)}
            </div>
          ) : null}
        </div>
      );
    };

    return (
      <div className="ptb-menu-pop" role="menu" aria-label={title}>
        {nodes.map(renderNode)}
      </div>
    );
  };

  return (
    <div className="ptb" ref={rootRef}>
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

      <OverwriteConfirmModal
        open={confirmNewOpen}
        title={isNo ? "Erstatte gjeldende prosjekt?" : "Replace current project?"}
        text={
          isNo
            ? "I gratis-modus kan du jobbe i ett prosjekt av gangen. Hvis du fortsetter, vil du overskrive det lagrede prosjektet ditt."
            : "In free mode you can work on one project at a time. If you continue, your saved project will be overwritten."
        }
        cancelLabel={isNo ? "Avbryt" : "Cancel"}
        confirmLabel={isNo ? "Overskriv" : "Overwrite"}
        onCancel={cancelNew}
        onConfirm={confirmNew}
      />
    </div>
  );
}
