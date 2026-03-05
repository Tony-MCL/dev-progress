// src/progress/CalendarModal.tsx
import React, { useMemo, useState } from "react";
import { useI18n } from "../i18n";

export type CalendarEntry = {
  id: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (>= from)
  label?: string;
};

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function cmpISO(a: string, b: string) {
  return a.localeCompare(b);
}

function clampToRange(fromISO: string, toISO: string) {
  const f = (fromISO || "").trim();
  const t = (toISO || "").trim();
  if (!f) return { from: "", to: "" };
  if (!t) return { from: f, to: f };
  return cmpISO(t, f) >= 0 ? { from: f, to: t } : { from: t, to: f };
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}
// Meeus/Jones/Butcher Gregorian algorithm
function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=March, 4=April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

type HolidayDef = { iso: string; key: string };

function norwegianHolidays(year: number): HolidayDef[] {
  const E = easterSunday(year);

  const fixed: HolidayDef[] = [
    { iso: `${year}-01-01`, key: "holidays.newYearsDay" },
    { iso: `${year}-05-01`, key: "holidays.labourDay" },
    { iso: `${year}-05-17`, key: "holidays.constitutionDay" },
    { iso: `${year}-12-25`, key: "holidays.christmasDay1" },
    { iso: `${year}-12-26`, key: "holidays.christmasDay2" },
  ];

  const movable: HolidayDef[] = [
    { iso: toISODate(addDays(E, -3)), key: "holidays.maundyThursday" },
    { iso: toISODate(addDays(E, -2)), key: "holidays.goodFriday" },
    { iso: toISODate(addDays(E, 0)), key: "holidays.easterSunday" },
    { iso: toISODate(addDays(E, 1)), key: "holidays.easterMonday" },
    { iso: toISODate(addDays(E, 39)), key: "holidays.ascensionDay" },
    { iso: toISODate(addDays(E, 49)), key: "holidays.whitSunday" },
    { iso: toISODate(addDays(E, 50)), key: "holidays.whitMonday" },
  ];

  return [...fixed, ...movable].sort((a, b) => cmpISO(a.iso, b.iso));
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function CalendarModal(props: {
  open: boolean;
  entries: CalendarEntry[];
  onChange: (next: CalendarEntry[]) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { open, entries, onChange, onClose } = props;

  // Left form
  const [from, setFrom] = useState<string>(isoToday());
  const [to, setTo] = useState<string>(isoToday());
  const [label, setLabel] = useState<string>("");

  // Holidays quick add
  const thisYear = new Date().getFullYear();
  const [holidayYear, setHolidayYear] = useState<number>(thisYear);
  const holidayDefs = useMemo(() => norwegianHolidays(holidayYear), [holidayYear]);
  const [holidayPick, setHolidayPick] = useState<Set<string>>(new Set());

  // Right list editing
  const [editId, setEditId] = useState<string | null>(null);
  const [editFrom, setEditFrom] = useState<string>("");
  const [editTo, setEditTo] = useState<string>("");
  const [editLabel, setEditLabel] = useState<string>("");

  const sorted = useMemo(() => {
    return [...entries].sort((a, b) => cmpISO(a.from, b.from) || cmpISO(a.to, b.to));
  }, [entries]);

  if (!open) return null;

  const addManual = () => {
    const r = clampToRange(from, to);
    if (!r.from) return;

    const item: CalendarEntry = {
      id: makeId("cal"),
      from: r.from,
      to: r.to,
      label: label.trim() || undefined,
    };

    onChange([...entries, item]);
    setLabel("");
  };

  const remove = (id: string) => {
    if (editId === id) setEditId(null);
    onChange(entries.filter((e) => e.id !== id));
  };

  const startEdit = (e: CalendarEntry) => {
    setEditId(e.id);
    setEditFrom(e.from);
    setEditTo(e.to || e.from);
    setEditLabel(e.label || "");
  };

  const cancelEdit = () => {
    setEditId(null);
  };

  const saveEdit = () => {
    if (!editId) return;
    const r = clampToRange(editFrom, editTo);
    if (!r.from) return;

    const next = entries.map((x) =>
      x.id === editId
        ? {
            ...x,
            from: r.from,
            to: r.to,
            label: editLabel.trim() || undefined,
          }
        : x
    );

    onChange(next);
    setEditId(null);
  };

  const addHolidays = (onlyPicked: boolean) => {
    const picked = holidayPick;
    const list = onlyPicked ? holidayDefs.filter((h) => picked.has(h.iso)) : holidayDefs;

    if (list.length === 0) return;

    // Avoid duplicates: same single-day iso + same label.
    const existingKey = new Set(
      entries.map((e) => `${e.from}|${e.to || e.from}|${(e.label || "").trim().toLowerCase()}`)
    );

    const toAdd: CalendarEntry[] = [];
    for (const h of list) {
      const labelText = t(h.key);
      const k = `${h.iso}|${h.iso}|${labelText.trim().toLowerCase()}`;
      if (existingKey.has(k)) continue;

      toAdd.push({
        id: makeId("hol"),
        from: h.iso,
        to: h.iso,
        label: labelText,
      });

      existingKey.add(k);
    }

    if (toAdd.length > 0) {
      onChange([...entries, ...toAdd]);
    }
  };

  const togglePick = (iso: string) => {
    setHolidayPick((prev) => {
      const next = new Set(prev);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  const clearPicks = () => setHolidayPick(new Set());

  const title = t("calendarModal.title");
  const intro = t("calendarModal.intro");
  const leftTitle = t("calendarModal.left.title");
  const fromLabel = t("calendarModal.fields.from");
  const toLabel = t("calendarModal.fields.to");
  const nameOptional = t("calendarModal.fields.nameOptional");
  const namePlaceholder = t("calendarModal.fields.namePlaceholder");
  const addPeriod = t("calendarModal.actions.addPeriod");
  const quickTitle = t("calendarModal.quick.title");
  const yearLabel = t("calendarModal.quick.year");
  const addAll = t("calendarModal.quick.addAll");
  const addPicked = t("calendarModal.quick.addPicked");
  const resetPick = t("calendarModal.quick.resetPick");
  const rightTitle = t("calendarModal.right.title");
  const countSuffix = t("calendarModal.right.countSuffix");
  const emptyText = t("calendarModal.right.empty");
  const editBtn = t("calendarModal.actions.edit");
  const deleteBtn = t("calendarModal.actions.delete");
  const saveBtn = t("calendarModal.actions.save");
  const cancelBtn = t("calendarModal.actions.cancel");
  const nameLabel = t("calendarModal.fields.name");
  const nameEditPlaceholder = t("calendarModal.fields.nameEditPlaceholder");
  const tip = t("calendarModal.tip");
  const closeBtn = t("calendarModal.actions.close");

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ptb-modal" style={{ maxWidth: 980, width: "min(980px, calc(100vw - 48px))" }}>
        <div className="ptb-modal-title">{title}</div>

        <div className="ptb-modal-text" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ opacity: 0.9 }}>{intro}</div>

          {/* Two-column layout */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 14,
              alignItems: "start",
            }}
          >
            {/* LEFT */}
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>{leftTitle}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "160px 160px 1fr",
                  gap: 10,
                  alignItems: "end",
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{fromLabel}</span>
                  <input
                    type="date"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{toLabel}</span>
                  <input
                    type="date"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>

                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{nameOptional}</span>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder={namePlaceholder}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                    }}
                  />
                </label>
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="ptb-btn ptb-btn--confirm" onClick={addManual}>
                  {addPeriod}
                </button>
              </div>

              <div style={{ height: 1, background: "rgba(0,0,0,0.10)" }} />

              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>{quickTitle}</div>

              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{yearLabel}</span>
                  <select
                    value={holidayYear}
                    onChange={(e) => {
                      setHolidayYear(Number(e.target.value));
                      clearPicks();
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 10,
                      border: "1px solid rgba(0,0,0,0.18)",
                      background: "white",
                      fontWeight: 700,
                    }}
                  >
                    {Array.from({ length: 6 }, (_, i) => {
                      const y = thisYear + i;
                      return (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      );
                    })}
                  </select>
                </label>

                <div style={{ display: "flex", gap: 10, marginLeft: "auto" }}>
                  <button type="button" className="ptb-btn ptb-btn--confirm" onClick={() => addHolidays(false)}>
                    {addAll}
                  </button>
                  <button
                    type="button"
                    className="ptb-btn ptb-btn--confirm"
                    onClick={() => addHolidays(true)}
                    disabled={holidayPick.size === 0}
                    style={holidayPick.size === 0 ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
                  >
                    {addPicked}
                  </button>
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  overflow: "hidden",
                  maxHeight: 240,
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {holidayDefs.map((h, idx) => (
                  <label
                    key={h.iso}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "22px 140px 1fr",
                      gap: 10,
                      alignItems: "center",
                      padding: "9px 12px",
                      borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                  >
                    <input type="checkbox" checked={holidayPick.has(h.iso)} onChange={() => togglePick(h.iso)} />
                    <div
                      style={{
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                        fontSize: 12,
                      }}
                    >
                      {h.iso}
                    </div>
                    <div style={{ opacity: 0.92, fontWeight: 700 }}>{t(h.key)}</div>
                  </label>
                ))}
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button type="button" className="ptb-btn ptb-btn--cancel" onClick={clearPicks}>
                  {resetPick}
                </button>
              </div>
            </div>

            {/* RIGHT */}
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.12)",
                borderRadius: 12,
                padding: 12,
                display: "flex",
                flexDirection: "column",
                gap: 10,
                minHeight: 420,
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>{rightTitle}</div>
                <div style={{ marginLeft: "auto", opacity: 0.8, fontSize: 12 }}>
                  {sorted.length} {countSuffix}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  overflow: "hidden",
                  maxHeight: 360,
                  overflowY: "auto",
                  background: "rgba(255,255,255,0.02)",
                }}
              >
                {sorted.length === 0 ? (
                  <div style={{ padding: 12, opacity: 0.8 }}>{emptyText}</div>
                ) : (
                  sorted.map((e, idx) => {
                    const isEditing = editId === e.id;

                    return (
                      <div
                        key={e.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          gap: 10,
                          alignItems: "center",
                          padding: "10px 12px",
                          borderTop: idx === 0 ? "none" : "1px solid rgba(0,0,0,0.08)",
                        }}
                      >
                        {!isEditing ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                            <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap" }}>
                              <div
                                style={{
                                  fontFamily:
                                    "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                  fontSize: 12,
                                  fontWeight: 800,
                                }}
                              >
                                {e.from}
                                {e.to && e.to !== e.from ? ` → ${e.to}` : ""}
                              </div>
                              <div style={{ opacity: 0.92, fontWeight: 700 }}>
                                {e.label || <span style={{ opacity: 0.6 }}>—</span>}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "140px 140px 1fr",
                              gap: 10,
                              alignItems: "end",
                            }}
                          >
                            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 12 }}>{fromLabel}</span>
                              <input
                                type="date"
                                value={editFrom}
                                onChange={(ev) => setEditFrom(ev.target.value)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                }}
                              />
                            </label>

                            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 12 }}>{toLabel}</span>
                              <input
                                type="date"
                                value={editTo}
                                onChange={(ev) => setEditTo(ev.target.value)}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                }}
                              />
                            </label>

                            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                              <span style={{ fontWeight: 700, fontSize: 12 }}>{nameLabel}</span>
                              <input
                                type="text"
                                value={editLabel}
                                onChange={(ev) => setEditLabel(ev.target.value)}
                                placeholder={nameEditPlaceholder}
                                style={{
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                }}
                              />
                            </label>
                          </div>
                        )}

                        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                          {!isEditing ? (
                            <>
                              <button type="button" className="ptb-btn ptb-btn--confirm" onClick={() => startEdit(e)}>
                                {editBtn}
                              </button>
                              <button type="button" className="ptb-btn ptb-btn--cancel" onClick={() => remove(e.id)}>
                                {deleteBtn}
                              </button>
                            </>
                          ) : (
                            <>
                              <button type="button" className="ptb-btn ptb-btn--confirm" onClick={saveEdit}>
                                {saveBtn}
                              </button>
                              <button type="button" className="ptb-btn ptb-btn--cancel" onClick={cancelEdit}>
                                {cancelBtn}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>{tip}</div>
            </div>
          </div>

          {/* Mobile fallback: stack columns */}
          <style>{`
            @media (max-width: 860px) {
              .ptb-modal > .ptb-modal-text > div[style*="grid-template-columns: 1fr 1fr"] {
                grid-template-columns: 1fr !important;
              }
            }
          `}</style>
        </div>

        <div className="ptb-modal-actions">
          <button type="button" className="ptb-btn ptb-btn--cancel" onClick={onClose}>
            {closeBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
