// src/progress/ProjectLibraryModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { ProjectDb, ProjectListItem, ProjectRecord } from "../storage/projectDbTypes";
import { useI18n } from "../i18n";

function fmtWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(+d)) return iso || "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${dd}.${m}.${y} ${hh}:${mm}`;
}

export default function ProjectLibraryModal(props: {
  open: boolean;
  db: ProjectDb;
  currentId?: string | null;
  onClose: () => void;
  onOpenProject: (rec: ProjectRecord) => void;
  onSetCurrentId?: (id: string | null) => void;
}) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ProjectListItem[]>([]);
  const [err, setErr] = useState<string>("");

  const canShow = props.open;

  const reload = async () => {
    setLoading(true);
    setErr("");
    try {
      const list = await props.db.list();
      setItems(list);
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canShow) return;
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canShow]);

  useEffect(() => {
    if (!canShow) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [canShow, props]);

  const activeId = props.currentId ?? null;

  const activeLabel = useMemo(() => {
    if (!activeId) return "";
    const hit = items.find((x) => x.id === activeId);
    return hit ? hit.title : "";
  }, [activeId, items]);

  const openRec = async (id: string) => {
    setLoading(true);
    setErr("");
    try {
      const rec = await props.db.get(id);
      if (!rec) {
        setErr(t("projectLibrary.notFound"));
        return;
      }
      props.onSetCurrentId?.(rec.id);
      props.onOpenProject(rec);
      props.onClose();
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Error"));
    } finally {
      setLoading(false);
    }
  };

  const deleteRec = async (id: string) => {
    // (ingen confirm-dialog her – du kan legge på pen modal senere)
    setLoading(true);
    setErr("");
    try {
      await props.db.remove(id);
      if (activeId === id) props.onSetCurrentId?.(null);
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Error"));
    } finally {
      setLoading(false);
    }
  };

  const duplicateRec = async (id: string) => {
    setLoading(true);
    setErr("");
    try {
      await props.db.duplicate(id);
      await reload();
    } catch (e: any) {
      setErr(String(e?.message ?? e ?? "Error"));
    } finally {
      setLoading(false);
    }
  };

  if (!canShow) return null;

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div
        className="ptb-modal"
        style={{
          width: "min(860px, calc(100vw - 24px))",
          maxHeight: "min(80vh, 720px)",
          overflow: "auto",
        }}
      >
        <div className="ptb-modal-title">{t("projectLibrary.title")}</div>

        <div style={{ fontSize: 13, opacity: 0.9, marginTop: 6 }}>
          {t("projectLibrary.intro")}
        </div>

        {activeId ? (
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
            <b>{t("projectLibrary.current")}:</b> {activeLabel || activeId}
          </div>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            className="ptb-btn ptb-btn--confirm"
            onClick={() => reload()}
            disabled={loading}
            style={{ background: "#1e66ff" }}
          >
            {t("projectLibrary.refresh")}
          </button>

          <div style={{ flex: 1 }} />

          <button type="button" className="ptb-btn ptb-btn--cancel" onClick={props.onClose} disabled={loading}>
            {t("projectLibrary.close")}
          </button>
        </div>

        {err ? (
          <div style={{ marginTop: 12, color: "#b00020", fontSize: 13, fontWeight: 700 }}>
            {err}
          </div>
        ) : null}

        <div
          style={{
            marginTop: 12,
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 180px 260px",
              gap: 0,
              background: "rgba(0,0,0,0.05)",
              padding: "10px 12px",
              fontSize: 12,
              fontWeight: 900,
            }}
          >
            <div>{t("projectLibrary.colTitle")}</div>
            <div>{t("projectLibrary.colUpdated")}</div>
            <div>{t("projectLibrary.colActions")}</div>
          </div>

          {items.length === 0 && !loading ? (
            <div style={{ padding: "14px 12px", fontSize: 13, opacity: 0.85 }}>
              {t("projectLibrary.empty")}
            </div>
          ) : null}

          {items.map((it) => {
            const isActive = activeId === it.id;

            return (
              <div
                key={it.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 180px 260px",
                  padding: "10px 12px",
                  borderTop: "1px solid rgba(0,0,0,0.08)",
                  alignItems: "center",
                }}
              >
                <div style={{ fontWeight: 900, display: "flex", gap: 8, alignItems: "center" }}>
                  {isActive ? <span title={t("projectLibrary.activeTip")}>●</span> : <span style={{ opacity: 0.25 }}>●</span>}
                  <span>{it.title}</span>
                </div>

                <div style={{ fontSize: 12, opacity: 0.9 }}>{fmtWhen(it.updatedAt)}</div>

                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="ptb-btn ptb-btn--confirm"
                    style={{ background: "#1e66ff" }}
                    onClick={() => openRec(it.id)}
                    disabled={loading}
                  >
                    {t("projectLibrary.open")}
                  </button>

                  <button
                    type="button"
                    className="ptb-btn ptb-btn--confirm"
                    style={{ background: "#1e66ff" }}
                    onClick={() => duplicateRec(it.id)}
                    disabled={loading}
                  >
                    {t("projectLibrary.duplicate")}
                  </button>

                  <button
                    type="button"
                    className="ptb-btn ptb-btn--cancel"
                    onClick={() => deleteRec(it.id)}
                    disabled={loading}
                    title={t("projectLibrary.deleteTip")}
                  >
                    {t("projectLibrary.delete")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {loading ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>{t("projectLibrary.loading")}</div>
        ) : null}
      </div>
    </div>
  );
}
