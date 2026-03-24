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

type CalendarAction = "calendarManage" | "setWorkWeek5" | "setWorkWeek6" | "setWorkWeek7";
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
      <span className="ptb-menu-caret" aria-hidden="true">
        ▾
      </span>
    </button>
  );
}

function MenuItem(props: {
  label: string;
  hint?: string;
  disabled?: boolean;
  title?: string;
  hasChildren?: boolean;
  onClick?: () => void;
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
  disabled,
  hasUnsavedChanges,
  confirmOnNew = true,
}: ProgressToolbarProps) {
  const { t, lang } = useI18n();

  const isNo = String(lang || "no").toLowerCase().startsWith("no");
  const isPro = activePlan === "pro" || activePlan === "trial";

  const rootRef = useRef<HTMLDivElement | null>(null);

  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [activeSubKey, setActiveSubKey] = useState<string | null>(null);

  const [confirmNewOpen, setConfirmNewOpen] = useState(false);
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
          label: t("toolbar.file.new"),
          hint: "Ctrl+N",
          action: "newBlank",
        },
  
        { kind: "divider" },
  
        {
          kind: "item",
          key: "openProject",
          label: isPro
            ? t("toolbar.file.openFromCloud")
            : t("toolbar.file.openProject"),
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
          label: isPro
            ? t("toolbar.file.saveToCloud")
            : t("toolbar.file.saveProject"),
          hint: "Ctrl+S",
          action: "save",
        },
  
        ...(isPro
          ? [
              {
                kind: "item" as const,
                key: "saveAs",
                label: t("toolbar.file.saveToFile"),
                action: "saveAs",
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
  
        ...(isPro
          ? [
              { kind: "divider" as const },
              {
                kind: "item" as const,
                key: "export",
                label: t("toolbar.file.export"),
                children: [
                  {
                    kind: "item" as const,
                    key: "exportTsv",
                    label: "TSV…",
                    action: "exportTsv",
                  },
                ],
              },
            ]
          : []),
  
        { kind: "divider" },
  
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
            },
          ],
        },
      ],
      [t, isPro]
    );

  const tableMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "columns",
        label: t("toolbar.table.columns"),
        children: [
          {
            kind: "item",
            key: "columnsManage",
            label: t("toolbar.table.chooseVisibleColumns"),
            action: "columnsManage",
          },
        ],
      },
      { kind: "divider" },
      {
        kind: "item",
        key: "rows",
        label: t("toolbar.table.rows"),
        children: [
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
          { kind: "divider" },
          {
            kind: "item",
            key: "deleteSelectedRows",
            label: t("toolbar.table.deleteSelectedRows"),
            action: "deleteSelectedRows",
          },
        ],
      },
    ],
    [t]
  );

  const ganttStandardColor = "#b98a3a";

  const ganttPalette12 = useMemo(() => {
    return [
      ganttStandardColor,
      "#2f7dd1",
      "#1e3a8a",
      "#2e9f6d",
      "#166534",
      "#d65b5b",
      "#b91c1c",
      "#8f63d2",
      "#6d28d9",
      "#4b5563",
      "#111827",
      "#f59e0b",
    ];
  }, []);

  const ganttMenu: MenuNode[] = useMemo(
    () => [
      {
        kind: "item",
        key: "zoom",
        label: t("toolbar.gantt.zoom"),
        children: [
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
        ],
      },

      { kind: "divider" },

      {
        kind: "item",
        key: "toggles",
        label: t("toolbar.gantt.view"),
        children: [
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
        ],
      },

      { kind: "divider" },

      {
        kind: "custom",
        key: "ganttTextToggle",
        render: () => {
          const label = isNo ? "Vis tekst på stolper" : "Show text on bars";
          return (
            <div
              style={{
                padding: "8px 10px",
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
        key: "colorPicker",
        label: t("toolbar.gantt.colorPicker.label"),
        children: [
          {
            kind: "custom",
            key: "colorPickerPanel",
            render: () => {
              const title = t("toolbar.gantt.colorPicker.title");
              const current = String(
                ganttDefaultBarColor || ganttStandardColor
              ).toLowerCase();

              return (
                <div
                  style={{
                    padding: "10px 10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                  role="menuitem"
                  aria-label={title}
                >
                  <div style={{ fontWeight: 800, fontSize: 12 }}>{title}</div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(6, 22px)",
                      gap: 8,
                      alignItems: "center",
                    }}
                  >
                    {ganttPalette12.map((c) => {
                      const cc = c.toLowerCase();
                      const isSelected = current === cc;
                      const isStandard =
                        cc === ganttStandardColor.toLowerCase();

                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => onSetGanttDefaultBarColor?.(c)}
                          disabled={disabled}
                          title={c}
                          aria-label={c}
                          style={{
                            width: 22,
                            height: 22,
                            borderRadius: 999,
                            background: c,
                            cursor: disabled ? "default" : "pointer",
                            border: isSelected
                              ? "3px solid rgba(0,0,0,0.70)"
                              : "1px solid rgba(0,0,0,0.25)",
                            // Standard-ring (always)
                            boxShadow: isStandard
                              ? "0 0 0 2px rgba(0,0,0,0.55)"
                              : "none",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            },
          },
        ],
      },
    ],
    [
      t,
      isNo,
      disabled,
      ganttShowBarText,
      onSetGanttShowBarText,
      ganttDefaultBarColor,
      onSetGanttDefaultBarColor,
      ganttPalette12,
    ]
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

  // ✅ NEW: confirm for all actions that replace the current project content
  const shouldConfirmOverwrite = (a: FileAction) => {
    if (a === "newBlank" || a === "newFromTemplate") {
      return !isPro && (confirmOnNew || !!hasUnsavedChanges);
    }

    if (a === "openProject") {
      return !isPro && !!hasUnsavedChanges;
    }

    if (a === "openFile" || a === "importTsv") {
      return !isPro && !!hasUnsavedChanges;
    }

    return false;
  };

  const doFileAction = (a: FileAction) => {
    // ✅ CHANGED: not only "newBlank" — also open/import actions
    if (shouldConfirmOverwrite(a)) {
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

  const renderMenuPop = (
    menuLabel: string,
    nodes: MenuNode[],
    runAction: (a?: string) => void
  ) => (
    <div className="ptb-menu-pop" role="menu" aria-label={`${menuLabel}-meny`}>
      {nodes.map((node, idx) => {
        if (node.kind === "divider") return <Divider key={`d-${idx}`} />;

        if (node.kind === "custom") {
          return (
            <div key={node.key} className="ptb-menu-itemwrap">
              {node.render()}
            </div>
          );
        }

        const hasChildren = !!node.children?.length;
        const subOpen = hasChildren && activeSubKey === node.key;

        return (
          <div key={node.key} className={`ptb-menu-itemwrap ${subOpen ? "is-subopen" : ""}`}>
            <MenuItem
              label={node.label}
              hint={node.hint}
              disabled={disabled || node.disabled}
              title={node.title}
              hasChildren={hasChildren}
              onClick={() => {
                if (disabled || node.disabled) return;

                if (hasChildren) {
                  setActiveSubKey((cur) => (cur === node.key ? null : node.key));
                  return;
                }

                if (node.action) runAction(node.action);
              }}
            />

            {hasChildren && subOpen ? (
              <div className="ptb-submenu" role="menu" aria-label={`${node.label}-undermeny`}>
                {node.children!.map((child: MenuNode, cIdx: number) => {
                  if (child.kind === "divider") return <Divider key={`sd-${idx}-${cIdx}`} />;

                  if (child.kind === "custom") {
                    return (
                      <div key={child.key} className="ptb-menu-itemwrap">
                        {child.render()}
                      </div>
                    );
                  }

                  const childHasChildren = !!(child as MenuItemNode).children?.length;

                  return (
                    <div key={child.key} className="ptb-menu-itemwrap">
                      <MenuItem
                        label={(child as MenuItemNode).label}
                        hint={(child as MenuItemNode).hint}
                        disabled={disabled || (child as MenuItemNode).disabled}
                        title={(child as MenuItemNode).title}
                        hasChildren={childHasChildren}
                        onClick={() => {
                          if (disabled || (child as MenuItemNode).disabled) return;
                          if (childHasChildren) return;
                          if ((child as MenuItemNode).action) runAction((child as MenuItemNode).action);
                        }}
                      />
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

  const fileOpen = openMenu === "file";
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
        title={t("toolbar.confirmOverwrite.title")}
        text={
          isPro
            ? t("toolbar.confirmOverwrite.textPro")
            : t("toolbar.confirmOverwrite.textFree")
        }
        cancelLabel={t("toolbar.confirmOverwrite.cancel")}
        confirmLabel={t("toolbar.confirmOverwrite.confirm")}
        onCancel={cancelNew}
        onConfirm={confirmNew}
      />
    </div>
  );
}
