import React, { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import type { TableCoreContextMenuRequest } from "../core/TableTypes";

type MenuAction =
  | "toggleMilestone"
  | "indentRows"
  | "outdentRows"
  | "cutSelection"
  | "copySelection"
  | "pasteClipboard"
  | "insertRowAbove"
  | "insertRowBelow"
  | "deleteRows"
  | "print"
  | "close";

type Props = {
  state: TableCoreContextMenuRequest | null;
  onClose: () => void;
  onAction: (action: MenuAction) => void | Promise<void>;
  isMilestoneSelection?: boolean;
};

function MenuButton(props: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      style={{
        width: "100%",
        textAlign: "left",
        border: "none",
        background: "transparent",
        padding: "10px 12px",
        borderRadius: 8,
        cursor: props.disabled ? "default" : "pointer",
        font: "inherit",
        opacity: props.disabled ? 0.45 : 1,
      }}
      onMouseEnter={(e) => {
        if (props.disabled) return;
        e.currentTarget.style.background = "rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    >
      {props.label}
    </button>
  );
}

function Divider() {
  return (
    <div
      style={{
        height: 1,
        background: "rgba(0,0,0,0.08)",
        margin: "4px 0",
      }}
    />
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ProgressTableContextMenu({
  state,
  onClose,
  onAction,
  isMilestoneSelection = false,
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { t } = useI18n();

  useEffect(() => {
    if (!state) return;

    const el = menuRef.current;
    if (!el) return;

    const placeMenu = () => {
      const rect = el.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const MARGIN = 8;

      let left = state.clientX;
      let top = state.clientY;

      if (left + rect.width + MARGIN > vw) {
        left = vw - rect.width - MARGIN;
      }
      if (top + rect.height + MARGIN > vh) {
        top = vh - rect.height - MARGIN;
      }

      left = clamp(left, MARGIN, Math.max(MARGIN, vw - rect.width - MARGIN));
      top = clamp(top, MARGIN, Math.max(MARGIN, vh - rect.height - MARGIN));

      el.style.left = `${left}px`;
      el.style.top = `${top}px`;
      el.style.visibility = "visible";
    };

    // Vent én frame så faktisk størrelse er på plass
    el.style.visibility = "hidden";
    el.style.left = `${state.clientX}px`;
    el.style.top = `${state.clientY}px`;

    const raf = window.requestAnimationFrame(placeMenu);
    return () => window.cancelAnimationFrame(raf);
  }, [state]);

  if (!state) return null;

  const rowLabel =
    typeof state.row === "number"
      ? `${t("contextMenu.row")} ${state.row + 1}`
      : t("contextMenu.noRow");

  const colLabel =
    typeof state.col === "number" && state.column
      ? `${t("contextMenu.column")}: ${state.column.title}`
      : t("contextMenu.noColumn");

  const sel = state.selection;
  const hasSelection =
    sel &&
    sel.r1 >= 0 &&
    sel.r2 >= 0 &&
    sel.c1 >= 0 &&
    sel.c2 >= 0;

  const selectionLabel = hasSelection
    ? `${t("contextMenu.selection")}: R${Math.min(sel.r1, sel.r2) + 1}–${
        Math.max(sel.r1, sel.r2) + 1
      }, ${t("contextMenu.columnShort")}${Math.min(sel.c1, sel.c2) + 1}–${
        Math.max(sel.c1, sel.c2) + 1
      }`
    : t("contextMenu.noSelection");

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={t("contextMenu.ariaLabel")}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: state.clientX,
        top: state.clientY,
        visibility: "hidden",
        zIndex: 100000,
        minWidth: 260,
        width: 320,
        maxWidth: "calc(100vw - 16px)",
        maxHeight: "calc(100vh - 16px)",
        overflowY: "auto",
        background: "var(--mcl-surface, #fff)",
        color: "var(--mcl-text, #111)",
        border: "1px solid rgba(0,0,0,0.16)",
        borderRadius: 12,
        boxShadow: "0 12px 28px rgba(0,0,0,0.18)",
        padding: 8,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <div
        style={{
          padding: "8px 12px 6px",
          fontSize: 12,
          fontWeight: 800,
          opacity: 0.8,
        }}
      >
        {t("contextMenu.title")}
      </div>

      <div
        style={{
          padding: "0 12px 8px",
          fontSize: 11,
          lineHeight: 1.4,
          opacity: 0.7,
        }}
      >
        <div>{rowLabel}</div>
        <div>{colLabel}</div>
        <div>{selectionLabel}</div>
      </div>

      <Divider />

      <MenuButton
        label={
          isMilestoneSelection
            ? t("contextMenu.removeMilestone")
            : t("contextMenu.makeMilestone")
        }
        onClick={() => onAction("toggleMilestone")}
      />
      <MenuButton
        label={t("contextMenu.indentRows")}
        onClick={() => onAction("indentRows")}
      />
      <MenuButton
        label={t("contextMenu.outdentRows")}
        onClick={() => onAction("outdentRows")}
      />

      <Divider />

      <MenuButton label={t("contextMenu.cut")} onClick={() => onAction("cutSelection")} />
      <MenuButton label={t("contextMenu.copy")} onClick={() => onAction("copySelection")} />
      <MenuButton label={t("contextMenu.paste")} onClick={() => onAction("pasteClipboard")} />

      <Divider />

      <MenuButton
        label={t("contextMenu.insertRowAbove")}
        onClick={() => onAction("insertRowAbove")}
      />
      <MenuButton
        label={t("contextMenu.insertRowBelow")}
        onClick={() => onAction("insertRowBelow")}
      />
      <MenuButton label={t("contextMenu.deleteRows")} onClick={() => onAction("deleteRows")} />

      <Divider />

      <MenuButton label={t("contextMenu.print")} onClick={() => onAction("print")} />

      <Divider />

      <MenuButton label={t("contextMenu.close")} onClick={() => onAction("close")} />
  );
}
