import React, { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { TableCoreContextMenuRequest } from "../core/TableTypes";

type MenuAction =
  | "milestoneDummy"
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
}: Props) {
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!state) {
      setMenuPos(null);
      return;
    }

    const el = menuRef.current;
    if (!el) {
      setMenuPos({
        left: state.clientX,
        top: state.clientY,
      });
      return;
    }

    const MARGIN = 8;
    const rect = el.getBoundingClientRect();

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const maxLeft = Math.max(MARGIN, vw - rect.width - MARGIN);
    const maxTop = Math.max(MARGIN, vh - rect.height - MARGIN);

    const nextLeft = clamp(state.clientX, MARGIN, maxLeft);
    const nextTop = clamp(state.clientY, MARGIN, maxTop);

    setMenuPos({
      left: nextLeft,
      top: nextTop,
    });
  }, [state]);

  if (!state) return null;

  const rowLabel =
    typeof state.row === "number" ? `Rad ${state.row + 1}` : "Ingen rad";

  const colLabel =
    typeof state.col === "number" && state.column
      ? `Kolonne: ${state.column.title}`
      : "Ingen kolonne";

  const sel = state.selection;
  const hasSelection =
    sel &&
    sel.r1 >= 0 &&
    sel.r2 >= 0 &&
    sel.c1 >= 0 &&
    sel.c2 >= 0;

  const selectionLabel = hasSelection
    ? `Markering: R${Math.min(sel.r1, sel.r2) + 1}–${Math.max(sel.r1, sel.r2) + 1}, K${Math.min(sel.c1, sel.c2) + 1}–${Math.max(sel.c1, sel.c2) + 1}`
    : "Ingen markering";

  const resolvedPos = useMemo(() => {
    return (
      menuPos ?? {
        left: state.clientX,
        top: state.clientY,
      }
    );
  }, [menuPos, state.clientX, state.clientY]);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Tabellmeny"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
      style={{
        position: "fixed",
        left: resolvedPos.left,
        top: resolvedPos.top,
        zIndex: 100000,
        minWidth: 260,
        maxWidth: 320,
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
        Tabellmeny
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
        label="Gjør til milepæl"
        onClick={() => onAction("milestoneDummy")}
      />
      <MenuButton
        label="Radinnrykk / gjør til underaktivitet"
        onClick={() => onAction("indentRows")}
      />
      <MenuButton
        label="Radutrykk / gjør til hovedaktivitet"
        onClick={() => onAction("outdentRows")}
      />

      <Divider />

      <MenuButton label="Klipp ut" onClick={() => onAction("cutSelection")} />
      <MenuButton label="Kopier" onClick={() => onAction("copySelection")} />
      <MenuButton label="Lim inn" onClick={() => onAction("pasteClipboard")} />

      <Divider />

      <MenuButton
        label="Sett inn rad over"
        onClick={() => onAction("insertRowAbove")}
      />
      <MenuButton
        label="Sett inn rad under"
        onClick={() => onAction("insertRowBelow")}
      />
      <MenuButton label="Slett rad(er)" onClick={() => onAction("deleteRows")} />

      <Divider />

      <MenuButton label="Skriv ut" onClick={() => onAction("print")} />

      <Divider />

      <MenuButton label="Lukk" onClick={() => onAction("close")} />
    </div>
  );
}
