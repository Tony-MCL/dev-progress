// ===============================
// src/progress/app/useSplitPane.ts
// ===============================
import { useEffect, useRef, useState } from "react";
import { PROGRESS_KEYS } from "../../storage/progressLocalKeys";
import { lsReadNumber, lsWriteNumber } from "../../storage/localSettings";
import { clamp01to100 } from "../ganttDateUtils";

type Result = {
  splitGridRef: React.RefObject<HTMLDivElement>;
  splitLeft: number;
  setSplitLeft: React.Dispatch<React.SetStateAction<number>>;
  onDividerPointerDown: React.PointerEventHandler<HTMLDivElement>;
  onDividerKeyDown: React.KeyboardEventHandler<HTMLDivElement>;
};

export function useSplitPane(): Result {
  // Typen må være RefObject<HTMLDivElement> for å passe direkte på ref={...}
  // (selv om current i praksis kan være null før mount).
  const splitGridRef = useRef<HTMLDivElement>(null as any);

  const [splitLeft, setSplitLeft] = useState<number>(() => {
    return clamp01to100(lsReadNumber(PROGRESS_KEYS.splitLeft, 50));
  });

  useEffect(() => {
    lsWriteNumber(PROGRESS_KEYS.splitLeft, splitLeft);
  }, [splitLeft]);

  const setFromClientX = (clientX: number) => {
    const grid = splitGridRef.current as HTMLDivElement | null;
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

  return {
    splitGridRef,
    splitLeft,
    setSplitLeft,
    onDividerPointerDown,
    onDividerKeyDown,
  };
}
