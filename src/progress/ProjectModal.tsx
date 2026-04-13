// ===============================
// src/progress/ProjectModal.tsx
// ===============================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n";
import { PROGRESS_RESPONSIBILITY_PALETTE } from "./ProgressColorSystem";

export type ProjectOwner = {
  id: string;
  name: string;
  color: string; // "" = default gantt-farge, ellers "#RRGGBB"
};

export type ProjectInfo = {
  projectName: string;
  customerName: string;
  projectNo: string; // Prosjektnr.
  baseStartISO: string; // YYYY-MM-DD
  workWeekDays: 5 | 6 | 7; // Arbeidsuke: 5=man-fre, 6=man-lør, 7=man-søn
  notes: string;
  owners: ProjectOwner[];
};

function isoToday(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function normalizeName(s: string) {
  return (s ?? "").trim();
}

function splitNames(multiline: string): string[] {
  return (multiline ?? "")
    .split(/\r?\n/g)
    .map((x) => normalizeName(x))
    .filter(Boolean);
}

function ColorGrid(props: {
  value: string; // "" or #RRGGBB
  onChange: (hexOrEmpty: string) => void;
  includeDefault?: boolean;
  disabled?: boolean;
  defaultLabel: string;
  defaultTitle: string;
}) {
  const { value, onChange, includeDefault, disabled, defaultLabel, defaultTitle } = props;
  const selected = String(value || "");

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
      {includeDefault ? (
        <button
          type="button"
          className="ptb-btn ptb-btn--cancel"
          onClick={() => onChange("")}
          disabled={disabled}
          title={defaultTitle}
        >
          {defaultLabel}
        </button>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 22px)",
          gap: 6,
          alignItems: "center",
        }}
      >
        {PROGRESS_RESPONSIBILITY_PALETTE.map((sw) => {
          const c = sw.hex;
          const active = selected.toUpperCase() === c.toUpperCase();
          return (
            <button
              key={sw.id}
              type="button"
              onClick={() => onChange(c)}
              disabled={disabled}
              title={`${sw.label} (${c})`}
              aria-label={`${sw.label} ${c}`}
              style={{
                width: 22,
                height: 22,
                borderRadius: 999,
                border: active ? "2px solid rgba(0,0,0,0.80)" : "1px solid rgba(0,0,0,0.22)",
                boxShadow: active ? "0 0 0 2px rgba(255,255,255,0.55) inset" : "none",
                background: c,
                cursor: disabled ? "default" : "pointer",
                padding: 0,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function ProjectModal(props: {
  open: boolean;
  value: ProjectInfo; // sist lagret (source of truth)
  onChange: (next: ProjectInfo) => void; // kalles på "Lagre prosjektinfo" og "Lagre ansvarlige"
  onClose: () => void;
}) {
  const { open, value, onChange, onClose } = props;
  const { t } = useI18n();

  // Draft for prosjektinfo (skal ikke live-vises på høyre side)
  const [draftProject, setDraftProject] = useState<
    Pick<ProjectInfo, "projectName" | "customerName" | "projectNo" | "baseStartISO" | "notes">
  >({
    projectName: "",
    customerName: "",
    projectNo: "",
    baseStartISO: isoToday(),
    notes: "",
  });

  // Draft for ansvarlige: kun tekstfelt (ett navn per linje)
  const [ownersText, setOwnersText] = useState<string>("");

  // Redigering på høyre side
  const [editOwnerId, setEditOwnerId] = useState<string | null>(null);
  const [editOwnerName, setEditOwnerName] = useState<string>("");
  const [editOwnerColor, setEditOwnerColor] = useState<string>(""); // "" = default
  const skipNextValueSyncRef = useRef(false);

  // Når modal åpnes: synk draft med sist lagret, og bygg ownersText fra sist lagret
  useEffect(() => {
    if (!open) return;

    if (skipNextValueSyncRef.current) {
      skipNextValueSyncRef.current = false;
      return;
    }

    setDraftProject({
      projectName: value.projectName ?? "",
      customerName: value.customerName ?? "",
      projectNo: value.projectNo ?? "",
      baseStartISO: value.baseStartISO || isoToday(),
      notes: value.notes ?? "",
    });

    const lines = (Array.isArray(value.owners) ? value.owners : [])
      .map((o) => normalizeName(o.name))
      .filter(Boolean);
    setOwnersText(lines.join("\n"));

    setEditOwnerId(null);
  }, [open, value]);

  // Sist lagret (forhåndsvisning + liste)
  const saved = value;

  const savedOwners: ProjectOwner[] = useMemo(() => {
    return Array.isArray(saved.owners) ? saved.owners : [];
  }, [saved.owners]);

  if (!open) return null;

  // -------------------------
  // Prosjektinfo: egen lagring
  // -------------------------
  const saveProjectInfo = () => {
    skipNextValueSyncRef.current = true;
    onChange({
      ...saved, // behold owners (og evt andre felt du legger til senere)
      projectName: normalizeName(draftProject.projectName),
      customerName: normalizeName(draftProject.customerName),
      projectNo: normalizeName(draftProject.projectNo),
      baseStartISO: draftProject.baseStartISO || isoToday(),
      // NB: arbeidsuke velges nå fra Kalender-menyen i toolbar.
      // Behold eksisterende verdi i prosjektet.
      workWeekDays:
        (saved as any).workWeekDays === 6 || (saved as any).workWeekDays === 7
          ? (saved as any).workWeekDays
          : 5,
      notes: draftProject.notes ?? "",
      owners: savedOwners,
    });
    // Ikke lukk – høyre side viser sist lagret
    resetProjectDraft();
  };

  const resetProjectDraft = () => {
    setDraftProject({
      projectName: "",
      customerName: "",
      projectNo: "",
      baseStartISO: isoToday(),
      notes: "",
    });
  };

  // -------------------------
  // Ansvarlige: egen lagring
  // Input venstre (multilinje) -> liste høyre
  // -------------------------
  const saveOwnersFromText = () => {
    const names = splitNames(ownersText);

    // Behold farger/ID hvis navnet finnes fra før (case-insensitive match)
    const byName = new Map<string, ProjectOwner>();
    for (const o of savedOwners) {
      const key = normalizeName(o.name).toLowerCase();
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, o);
    }

    // Unike navn i rekkefølge
    const seen = new Set<string>();
    const nextOwners: ProjectOwner[] = [];
    for (const n of names) {
      const key = n.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = byName.get(key);
      if (existing) {
        nextOwners.push({
          ...existing,
          name: n, // oppdater casing dersom bruker skrev annerledes
          color: existing.color || "",
        });
      } else {
        nextOwners.push({
          id: makeId("own"),
          name: n,
          color: "", // default
        });
      }
    }

    skipNextValueSyncRef.current = true;
    onChange({
      ...saved,
      owners: nextOwners,
    });

    setEditOwnerId(null);
    setOwnersText("");
  };

  const startEditOwner = (o: ProjectOwner) => {
    setEditOwnerId(o.id);
    setEditOwnerName(o.name ?? "");
    setEditOwnerColor(o.color ?? "");
  };

  const cancelEditOwner = () => {
    setEditOwnerId(null);
  };

  const commitEditOwner = () => {
    if (!editOwnerId) return;
    const newName = normalizeName(editOwnerName);
    if (!newName) return;

    const nextOwners = savedOwners.map((o) =>
      o.id === editOwnerId
        ? {
            ...o,
            name: newName,
            color: editOwnerColor || "", // "" = default
          }
        : o
    );

    onChange({
      ...saved,
      owners: nextOwners,
    });

    // Oppdater også tekstfeltet til venstre, så alt er synk
    setOwnersText(nextOwners.map((x) => x.name).join("\n"));
    setEditOwnerId(null);
  };

  const deleteOwner = (id: string) => {
    const nextOwners = savedOwners.filter((o) => o.id !== id);
    onChange({
      ...saved,
      owners: nextOwners,
    });
    setOwnersText(nextOwners.map((x) => x.name).join("\n"));
    if (editOwnerId === id) setEditOwnerId(null);
  };

  const setColor = (hexOrEmpty: string) => {
    setEditOwnerColor(hexOrEmpty || "");
  };

  const savedProjectName = saved.projectName?.trim() || t("projectModal.preview.defaults.projectName");
  const savedCustomerName = saved.customerName?.trim() || t("projectModal.preview.defaults.dash");
  const savedProjectNo = saved.projectNo?.trim() || t("projectModal.preview.defaults.dash");
  const savedBaseStart = saved.baseStartISO || t("projectModal.preview.defaults.dash");
  const savedNotes = saved.notes?.trim() ? saved.notes : t("projectModal.preview.defaults.notes");

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ptb-modal" style={{ maxWidth: 980, width: "min(980px, calc(100vw - 48px))" }}>
        <div className="ptb-modal-title">{t("projectModal.title")}</div>

        <div className="ptb-modal-text" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ opacity: 0.9 }}>{t("projectModal.intro")}</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, alignItems: "start" }}>
            {/* VENSTRE: input */}
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
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                {t("projectModal.left.projectDraftTitle")}
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.projectName")}</span>
                <input
                  type="text"
                  value={draftProject.projectName}
                  onChange={(e) => setDraftProject((v) => ({ ...v, projectName: e.target.value }))}
                  placeholder={t("projectModal.placeholders.projectName")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.customer")}</span>
                <input
                  type="text"
                  value={draftProject.customerName}
                  onChange={(e) => setDraftProject((v) => ({ ...v, customerName: e.target.value }))}
                  placeholder={t("projectModal.placeholders.customer")}
                  style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 180px", gap: 10, alignItems: "end" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.projectNo")}</span>
                  <input
                    type="text"
                    value={draftProject.projectNo}
                    onChange={(e) => setDraftProject((v) => ({ ...v, projectNo: e.target.value }))}
                    placeholder={t("projectModal.placeholders.projectNo")}
                    style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                  />
                </label>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.start")}</span>
                    <input
                      type="date"
                      value={draftProject.baseStartISO}
                      onChange={(e) => setDraftProject((v) => ({ ...v, baseStartISO: e.target.value }))}
                      style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid rgba(0,0,0,0.18)" }}
                    />
                  </label>
                </div>
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.notesOptional")}</span>
                <textarea
                  value={draftProject.notes}
                  onChange={(e) => setDraftProject((v) => ({ ...v, notes: e.target.value }))}
                  placeholder={t("projectModal.placeholders.notes")}
                  rows={5}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="ptb-btn ptb-btn--cancel" onClick={resetProjectDraft}>
                  {t("projectModal.actions.reset")}
                </button>
                <button type="button" className="ptb-btn ptb-btn--confirm" onClick={saveProjectInfo}>
                  {t("projectModal.actions.saveProject")}
                </button>
              </div>

              <div style={{ height: 1, background: "rgba(0,0,0,0.10)" }} />

              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                {t("projectModal.left.ownersDraftTitle")}
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.onePerLine")}</span>
                <textarea
                  value={ownersText}
                  onChange={(e) => setOwnersText(e.target.value)}
                  placeholder={t("projectModal.placeholders.ownersList")}
                  rows={6}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(0,0,0,0.18)",
                    resize: "vertical",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                  }}
                />
              </label>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="ptb-btn ptb-btn--confirm" onClick={saveOwnersFromText}>
                  {t("projectModal.actions.saveOwners")}
                </button>
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>{t("projectModal.tips.ownerColor")}</div>
            </div>

            {/* HØYRE: sist lagret */}
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
              <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                {t("projectModal.right.previewTitle")}
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 14 }}>{savedProjectName}</div>
                <div style={{ opacity: 0.9 }}>
                  <b>{t("projectModal.preview.labels.customer")}</b> {savedCustomerName}
                </div>
                <div style={{ opacity: 0.9 }}>
                  <b>{t("projectModal.preview.labels.projectNo")}</b> {savedProjectNo}
                </div>
                <div style={{ opacity: 0.9 }}>
                  <b>{t("projectModal.preview.labels.start")}</b> {savedBaseStart}
                </div>

                <div style={{ height: 1, background: "rgba(0,0,0,0.10)", margin: "6px 0" }} />

                <div style={{ opacity: 0.9, whiteSpace: "pre-wrap" }}>{savedNotes}</div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.12)",
                  borderRadius: 12,
                  padding: 12,
                  background: "rgba(255,255,255,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ fontWeight: 900, fontSize: 12, opacity: 0.9 }}>
                  {t("projectModal.right.ownersTitle")}
                </div>

                {savedOwners.length === 0 ? (
                  <div style={{ opacity: 0.75, fontSize: 12 }}>{t("projectModal.right.ownersEmpty")}</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {savedOwners.map((o) => {
                      const isEditing = editOwnerId === o.id;
                      const colorDot = o.color ? o.color : "transparent";

                      return (
                        <div
                          key={o.id}
                          style={{
                            border: "1px solid rgba(0,0,0,0.10)",
                            borderRadius: 12,
                            padding: 10,
                            display: "flex",
                            flexDirection: "column",
                            gap: 10,
                          }}
                        >
                          {!isEditing ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <div
                                title={o.color ? t("projectModal.owner.colorCustom") : t("projectModal.owner.colorDefault")}
                                style={{
                                  width: 14,
                                  height: 14,
                                  borderRadius: 999,
                                  background: colorDot,
                                  border: "1px solid rgba(0,0,0,0.18)",
                                  boxShadow: o.color ? "none" : "inset 0 0 0 999px rgba(0,0,0,0.04)",
                                }}
                              />
                              <div style={{ fontWeight: 800, opacity: 0.92 }}>{o.name}</div>

                              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                                <button
                                  type="button"
                                  className="ptb-btn ptb-btn--confirm"
                                  onClick={() => startEditOwner(o)}
                                >
                                  {t("projectModal.actions.edit")}
                                </button>
                                <button
                                  type="button"
                                  className="ptb-btn ptb-btn--cancel"
                                  onClick={() => deleteOwner(o.id)}
                                >
                                  {t("projectModal.actions.delete")}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                                <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <span style={{ fontWeight: 700, fontSize: 12 }}>{t("projectModal.fields.name")}</span>
                                  <input
                                    type="text"
                                    value={editOwnerName}
                                    onChange={(e) => setEditOwnerName(e.target.value)}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 10,
                                      border: "1px solid rgba(0,0,0,0.18)",
                                    }}
                                  />
                                </label>

                                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                  <div style={{ fontWeight: 700, fontSize: 12 }}>
                                    {t("projectModal.fields.ganttColorOptional")}
                                  </div>

                                  <ColorGrid
                                    value={editOwnerColor || ""}
                                    onChange={setColor}
                                    includeDefault
                                    disabled={false}
                                    defaultLabel={t("projectModal.actions.default")}
                                    defaultTitle={t("projectModal.actions.useDefault")}
                                  />
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                <button type="button" className="ptb-btn ptb-btn--confirm" onClick={commitEditOwner}>
                                  {t("projectModal.actions.save")}
                                </button>
                                <button type="button" className="ptb-btn ptb-btn--cancel" onClick={cancelEditOwner}>
                                  {t("projectModal.actions.cancel")}
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ opacity: 0.75, fontSize: 12 }}>{t("projectModal.footer.next")}</div>
            </div>
          </div>

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
            {t("projectModal.actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
