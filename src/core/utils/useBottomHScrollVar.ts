// src/core/utils/useBottomHScrollVar.ts
import { useEffect } from "react";
import type React from "react";

export function useBottomHScrollVar(opts: {
  hostEl: React.RefObject<HTMLDivElement>;
  measureEl: React.RefObject<HTMLDivElement>;
  barEl: React.RefObject<HTMLDivElement>;
  spacerEl: React.RefObject<HTMLDivElement>;
}) {
  const { hostEl, measureEl, barEl, spacerEl } = opts;

  useEffect(() => {
    const host = hostEl.current;
    const measure = measureEl.current;
    const bar = barEl.current;
    const spacer = spacerEl.current;
    if (!host || !measure || !bar || !spacer) return;

    const clamp = (v: number, min: number, max: number) =>
      Math.max(min, Math.min(max, v));

    const updateSpacerWidth = () => {
      const w = measure.scrollWidth;
      spacer.style.width = `${w}px`;

      const maxScroll = Math.max(0, w - bar.clientWidth);
      const next = clamp(bar.scrollLeft, 0, maxScroll);
      if (next !== bar.scrollLeft) bar.scrollLeft = next;

      host.style.setProperty("--x", String(next));
    };

    const onBarScroll = () => {
      host.style.setProperty("--x", String(bar.scrollLeft));
    };

    updateSpacerWidth();
    host.style.setProperty("--x", String(bar.scrollLeft));

    bar.addEventListener("scroll", onBarScroll, { passive: true });

    const ro = new ResizeObserver(() => updateSpacerWidth());
    ro.observe(measure);

    const onWin = () => updateSpacerWidth();
    window.addEventListener("resize", onWin);

    return () => {
      bar.removeEventListener("scroll", onBarScroll as any);
      ro.disconnect();
      window.removeEventListener("resize", onWin);
    };
  }, [hostEl, measureEl, barEl, spacerEl]);
}
