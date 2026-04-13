// src/progress/AdjustPopovers.tsx
import React, { useEffect, useRef } from "react";

export type DurPopoverState = { row: number; newDur: number; x: number; y: number };

export function DurationAdjustPopover(props: {
  state: DurPopoverState | null;
  onPick: (choice: "moveStart" | "moveEnd") => void;
  onClose: () => void;
  titleText: string;
  moveStartText: string;
  moveEndText: string;
  keepEndMoveStartTitle: string;
  keepStartMoveEndTitle: string;
}) {
  const {
    state,
    onPick,
    onClose,
    titleText,
    moveStartText,
    moveEndText,
    keepEndMoveStartTitle,
    keepStartMoveEndTitle,
  } = props;

  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onDown = (e: MouseEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onClose();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [state, onClose]);

  if (!state) return null;

  const PAD = 8;
  const estW = 220;
  const estH = 72;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = state.x + 10;
  let top = state.y + 10;

  if (left + estW > vw - PAD) left = Math.max(PAD, vw - PAD - estW);
  if (top + estH > vh - PAD) top = Math.max(PAD, vh - PAD - estH);

  return (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 99999,
        background: "white",
        border: "1px solid rgba(0,0,0,0.18)",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
        padding: "8px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        userSelect: "none",
      }}
    >
      <div style={{ fontWeight: 800, fontSize: 12, lineHeight: 1.1 }}>
        {titleText}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={() => onPick("moveStart")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
          title={keepEndMoveStartTitle}
        >
          {moveStartText}
        </button>

        <button
          type="button"
          onClick={() => onPick("moveEnd")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
          title={keepStartMoveEndTitle}
        >
          {moveEndText}
        </button>
      </div>
    </div>
  );
}

export type WeekendPopoverState = {
  row: number;
  columnKey: "start" | "end";
  prevValue: any;
  rawNextValue: any;
  parsedDate: Date;
  x: number;
  y: number;
};

export function WeekendAdjustPopover(props: {
  state: WeekendPopoverState | null;
  onPick: (choice: "prevWorkday" | "nextWorkday") => void;
  onCancel: () => void;
  titleText: string;
  prevText: string;
  nextText: string;
  cancelText: string;
}) {
  const { state, onPick, onCancel, titleText, prevText, nextText, cancelText } =
    props;

  const popRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!state) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    const onDown = (e: MouseEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;
      onCancel();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [state, onCancel]);

  if (!state) return null;

  const PAD = 8;
  const estW = 260;
  const estH = 98;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = state.x + 10;
  let top = state.y + 10;

  if (left + estW > vw - PAD) left = Math.max(PAD, vw - PAD - estW);
  if (top + estH > vh - PAD) top = Math.max(PAD, vh - PAD - estH);

  return (
    <div
      ref={popRef}
      style={{
        position: "fixed",
        left,
        top,
        zIndex: 99999,
        background: "white",
        border: "1px solid rgba(0,0,0,0.18)",
        borderRadius: 10,
        boxShadow: "0 10px 24px rgba(0,0,0,0.20)",
        padding: "10px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        userSelect: "none",
        maxWidth: 320,
      }}
    >
      <div style={{ fontWeight: 900, fontSize: 12, lineHeight: 1.2 }}>
        {titleText}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => onPick("prevWorkday")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {prevText}
        </button>

        <button
          type="button"
          onClick={() => onPick("nextWorkday")}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "#1e66ff",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {nextText}
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: "6px 8px",
            borderRadius: 8,
            border: "1px solid rgba(0,0,0,0.18)",
            background: "white",
            color: "#111",
            cursor: "pointer",
            fontWeight: 800,
            fontSize: 12,
            lineHeight: 1,
          }}
        >
          {cancelText}
        </button>
      </div>
    </div>
  );
}
