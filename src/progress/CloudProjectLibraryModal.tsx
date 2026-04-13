// src/progress/CloudProjectLibraryModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import type { UseAuthUserResult } from "../auth/useAuthUser";
import type { ProjectRecord } from "../storage/projectDbTypes";
import { useI18n } from "../i18n";
import { getProgressProjectFromCloud, listProgressProjectsFromCloud } from "../cloud/cloudProjects";

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

async function getTokenOrThrow(auth: UseAuthUserResult): Promise<string> {
  const t = await auth.getIdToken(true);
  const token = String(t || "").trim();
  if (!token) throw new Error("MISSING_AUTH_TOKEN");
  return token;
}

type Props = {
  open: boolean;
  currentId?: string | null;
  onSetCurrentId?: (id: string | null) => void;
  onClose: () => void;

  onOpenProject: (rec: ProjectRecord) => void;

  apiBase: string;
  auth: UseAuthUserResult;
  orgId?: string;
};

export default function CloudProjectLibraryModal(props: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; title: string; updatedAt: string }>>([]);
  const [err, setErr] = useState<string>("");

  const canShow = props.open;
  const activeId = props.currentId ?? null;

  const activeLabel = useMemo(() => {
    if (!activeId) return "";
    const hit = items.find((x) => x.id === activeId);
    return hit ? hit.title : "";
  }, [activeId, items]);

  const reload = async () => {
    setLoading(true);
    setErr("");
    try {
      const token = await getTokenOrThrow(props.auth);

      const res = await listProgressProjectsFromCloud({
        apiBase: props.apiBase,
        token,
        orgId: props.orgId,
      });

      const list = (res.projects || [])
        .map((p) => ({
          id: p.id,
          title: p.title,
          updatedAt: p.updatedAt || "",
        }))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

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

  const openCloud = async (id: string) => {
    setLoading(true);
    setErr("");
    try {
      const token = await getTokenOrThrow(props.auth);

      const got = await getProgressProjectFromCloud({
        apiBase: props.apiBase,
        token,
        projectId: id,
        orgId: props.orgId,
      });

      const rec: ProjectRecord = {
        id: got.id,
        title: got.title,
        updatedAt: got.updatedAt || new Date().toISOString(),
        snapshot: got.snapshot,
      } as any;

      props.onSetCurrentId?.(rec.id);
      props.onOpenProject(rec);
      props.onClose();
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
          <div style={{ marginTop: 12, color: "#b00020", fontSize: 13, fontWeight: 700 }}>{err}</div>
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
            <div style={{ padding: "14px 12px", fontSize: 13, opacity: 0.85 }}>{t("projectLibrary.empty")}</div>
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
                    onClick={() => openCloud(it.id)}
                    disabled={loading}
                  >
                    {t("projectLibrary.open")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {loading ? <div style={{ marginTop: 12, fontSize: 12, opacity: 0.75 }}>{t("projectLibrary.loading")}</div> : null}
      </div>
    </div>
  );
}
