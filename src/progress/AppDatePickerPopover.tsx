// src/progress/AppDatePickerPopover.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { useI18n } from "../i18n";

export type DatePickerMove = "none" | "next";

export type DatePickerRequest = {
  row: number;
  columnKey: string;
  draftValue: string;
  anchorRect: DOMRect;

  setDraft: (next: string) => void;
  commit: (next: string, opts?: { move?: DatePickerMove }) => void;
  cancel: () => void;
};

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, m: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function parseDMYLooseLocal(raw: string): Date | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;

  const m = str.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})$/);
  if (!m) return null;

  const dd = Number(m[1]);
  const mm = Number(m[2]);
  let yy = Number(m[3]);

  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yy)) {
    return null;
  }

  if (yy < 100) yy = 2000 + yy;

  const d = new Date(yy, mm - 1, dd);
  if (Number.isNaN(+d)) return null;

  if (
    d.getFullYear() !== yy ||
    d.getMonth() !== mm - 1 ||
    d.getDate() !== dd
  ) {
    return null;
  }

  return d;
}

function formatDMYLocal(d: Date) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear());
  return `${dd}.${mm}.${yy}`;
}

export default function AppDatePickerPopover(props: {
  req: DatePickerRequest | null;
  onRequestClose: () => void;
}) {
  const { req, onRequestClose } = props;
  const { t } = useI18n();

  const popRef = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = React.useState<string>("");

  const initialSelected = useMemo(() => {
    if (!req) return null;
    return parseDMYLooseLocal(req.draftValue);
  }, [req]);

  const [viewMonth, setViewMonth] = React.useState<Date>(() => {
    const base = initialSelected ?? new Date();
    return startOfMonth(base);
  });

  useEffect(() => {
    if (!req) return;

    setDraft(String(req.draftValue ?? ""));

    const base = parseDMYLooseLocal(req.draftValue) ?? new Date();
    setViewMonth(startOfMonth(base));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req?.row, req?.columnKey]);

  const setDraftBoth = (next: string) => {
    setDraft(next);
    req?.setDraft(next);
  };

  useEffect(() => {
    if (!req) return;

    const onKey = (e: KeyboardEvent) => {
      if (!req) return;

      if (e.key === "Escape") {
        e.preventDefault();
        req.cancel();
        onRequestClose();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        req.commit(draft, { move: "none" });
        onRequestClose();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        req.commit(draft, { move: "next" });
        onRequestClose();
      }
    };

    const onDown = (e: MouseEvent) => {
      const el = popRef.current;
      if (!el) return;
      if (el.contains(e.target as Node)) return;

      req.commit(draft, { move: "none" });
      onRequestClose();
    };

    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onDown, true);

    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onDown, true);
    };
  }, [req, onRequestClose, draft]);

  if (!req) return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const isCoarsePointer =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;

  const SCALE = (() => {
    if (isCoarsePointer || vw <= 720) return 0.95;
    if (vw <= 1100) return 0.88;
    return 0.82;
  })();

  const s = (v: number) => Math.round(v * SCALE);

  const PAD = 8;
  const estW = s(380);
  const estH = s(350);

  let left = req.anchorRect.left;
  let top = req.anchorRect.bottom + 6;

  left = clamp(left, PAD, vw - PAD - estW);
  if (top + estH > vh - PAD) top = req.anchorRect.top - 6 - estH;
  top = clamp(top, PAD, vh - PAD - estH);

  const first = startOfMonth(viewMonth);
  const firstWeekday = (first.getDay() + 6) % 7;
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - firstWeekday);

  const days: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    days.push(d);
  }

  const selected = parseDMYLooseLocal(draft);
  const today = new Date();
  const BLUE = "#1e66ff";

  const monthKeys = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ] as const;

  const monthOptions = monthKeys.map((key, index) => ({
    value: index,
    label: t(`app.datePicker.monthFull.${key}`),
  }));

  const centerYear = viewMonth.getFullYear();
  const yearOptions: number[] = [];

  for (let y = centerYear - 20; y <= centerYear + 20; y++) {
    yearOptions.push(y);
  }

  const monthLabel = `${t(
    `app.datePicker.monthFull.${monthKeys[viewMonth.getMonth()]}`
  )} ${viewMonth.getFullYear()}`;

  const weekdayLabels = [
    t("app.datePicker.weekdayShort.mon"),
    t("app.datePicker.weekdayShort.tue"),
    t("app.datePicker.weekdayShort.wed"),
    t("app.datePicker.weekdayShort.thu"),
    t("app.datePicker.weekdayShort.fri"),
    t("app.datePicker.weekdayShort.sat"),
    t("app.datePicker.weekdayShort.sun"),
  ];

  const clear = () => setDraftBoth("");

  const goToday = () => {
    const tdy = new Date();
    setViewMonth(startOfMonth(tdy));
    setDraftBoth(formatDMYLocal(tdy));
  };

  const selectStyle: React.CSSProperties = {
    appearance: "none",
    WebkitAppearance: "none",
    MozAppearance: "none",
    border: "1px solid rgba(0,0,0,0.12)",
    background: "white",
    borderRadius: s(10),
    cursor: "pointer",
    fontWeight: 700,
    color: "#111",
    fontSize: s(15),
    height: s(36),
    padding: `0 ${s(28)}px 0 ${s(10)}px`,
    lineHeight: `${s(34)}px`,
    outline: "none",
    maxWidth: s(150),
  };

  const selectWrapStyle: React.CSSProperties = {
    position: "relative",
    display: "inline-flex",
    alignItems: "center",
  };

  const selectArrowStyle: React.CSSProperties = {
    position: "absolute",
    right: s(10),
    pointerEvents: "none",
    color: "rgba(0,0,0,0.55)",
    fontSize: s(10),
    lineHeight: 1,
  };

  return (
    <div
      ref={popRef}
      data-mcl-datepicker="1"
      style={{
        position: "fixed",
        left,
        top,
        width: estW,
        zIndex: 99999,
        background: "white",
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: s(14),
        boxShadow: "0 10px 26px rgba(0,0,0,0.18)",
        padding: s(10),
        userSelect: "none",
      }}
      role="dialog"
      aria-label={t("app.datePicker.ariaLabel")}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: s(8),
          gap: s(8),
        }}
      >
        <button
          type="button"
          onClick={() => setViewMonth((v) => startOfMonth(addMonths(v, -1)))}
          style={{
            width: s(36),
            height: s(36),
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            borderRadius: s(10),
            cursor: "pointer",
            fontWeight: 700,
            color: "#111",
            lineHeight: `${s(34)}px`,
            padding: 0,
            flex: "0 0 auto",
          }}
          aria-label={t("app.datePicker.prevMonthAria")}
        >
          ‹
        </button>

        <div
          aria-label={monthLabel}
          style={{
            flex: "1 1 auto",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: s(6),
          }}
        >
          <span style={selectWrapStyle}>
            <select
              value={viewMonth.getMonth()}
              onChange={(e) => {
                const nextMonth = Number(e.target.value);
                setViewMonth(
                  (v) => new Date(v.getFullYear(), nextMonth, 1)
                );
              }}
              style={selectStyle}
              title={monthLabel}
            >
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <span style={selectArrowStyle}>▾</span>
          </span>

          <span style={selectWrapStyle}>
            <select
              value={viewMonth.getFullYear()}
              onChange={(e) => {
                const nextYear = Number(e.target.value);
                setViewMonth(
                  (v) => new Date(nextYear, v.getMonth(), 1)
                );
              }}
              style={{
                ...selectStyle,
                maxWidth: s(100),
              }}
              title={monthLabel}
            >
              {yearOptions.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <span style={selectArrowStyle}>▾</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setViewMonth((v) => startOfMonth(addMonths(v, +1)))}
          style={{
            width: s(36),
            height: s(36),
            border: "1px solid rgba(0,0,0,0.12)",
            background: "white",
            borderRadius: s(10),
            cursor: "pointer",
            fontWeight: 700,
            color: "#111",
            lineHeight: `${s(34)}px`,
            padding: 0,
            flex: "0 0 auto",
          }}
          aria-label={t("app.datePicker.nextMonthAria")}
        >
          ›
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          marginBottom: s(6),
          fontSize: s(12),
          fontWeight: 600,
          color: "rgba(0,0,0,0.55)",
          textAlign: "center",
        }}
      >
        {weekdayLabels.map((x) => (
          <div key={x} style={{ padding: `${s(4)}px 0` }}>
            {x}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: 0,
        }}
      >
        {days.map((d, idx) => {
          const isSel = !!selected && isSameDay(d, selected);
          const other = d.getMonth() !== viewMonth.getMonth();
          const isTod = isSameDay(d, today);

          const baseColor = other ? "rgba(0,0,0,0.25)" : "#111";

          return (
            <button
              key={idx}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDraftBoth(formatDMYLocal(d));
              }}
              style={{
                height: s(36),
                width: "100%",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                padding: 0,
                margin: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: isSel ? 700 : 600,
                fontSize: s(14),
                color: isSel ? "white" : baseColor,
                outline: "none",
              }}
              aria-label={formatDMYLocal(d)}
            >
              <span
                style={{
                  width: s(30),
                  height: s(30),
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: isSel ? BLUE : "transparent",
                  boxShadow: isSel
                    ? "0 6px 14px rgba(30,102,255,0.22)"
                    : "none",
                  border:
                    !isSel && isTod
                      ? `1px solid rgba(30,102,255,0.55)`
                      : "1px solid transparent",
                }}
              >
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          marginTop: s(12),
        }}
      >
        <button
          type="button"
          onClick={clear}
          style={{
            justifySelf: "start",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            color: BLUE,
            fontWeight: 600,
            fontSize: s(14),
          }}
          title={t("app.datePicker.clearTitle")}
        >
          {t("app.datePicker.clear")}
        </button>

        <button
          type="button"
          onClick={() => {
            req.commit(draft, { move: "none" });
            onRequestClose();
          }}
          style={{
            border: "none",
            background: BLUE,
            color: "white",
            borderRadius: s(12),
            padding: `${s(10)}px ${s(28)}px`,
            cursor: "pointer",
            fontWeight: 700,
            fontSize: s(14),
            boxShadow: "0 10px 18px rgba(30,102,255,0.22)",
          }}
          title={t("app.datePicker.okTitle")}
        >
          {t("app.datePicker.ok")}
        </button>

        <button
          type="button"
          onClick={goToday}
          style={{
            justifySelf: "end",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            color: BLUE,
            fontWeight: 600,
            fontSize: s(14),
          }}
          title={t("app.datePicker.todayTitle")}
        >
          {t("app.datePicker.today")}
        </button>
      </div>
    </div>
  );
}
