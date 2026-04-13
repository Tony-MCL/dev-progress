// src/progress/ColumnManagerModal.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ColumnDef } from "../core/TableTypes";
import type { AppColumnDef } from "./tableCommands";
import { useI18n } from "../i18n";

type Props = {
  open: boolean;
  columns: AppColumnDef[];
  onClose: () => void;
  onChange: (next: AppColumnDef[]) => void;
  onAddColumn: (spec: { title: string; type: "text" | "number" | "date" }) => void;
};

export default function ColumnManagerModal({
  open,
  columns,
  onClose,
  onChange,
  onAddColumn,
}: Props) {
  const { t } = useI18n();
  const boxRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<"text" | "number" | "date">("text");

  const sorted = useMemo(() => {
    // behold rekkefølgen slik den er i appen
    return columns;
  }, [columns]);

  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const onDown = (e: MouseEvent) => {
      const el = boxRef.current;
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
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      setTitle("");
      setType("text");
    }
  }, [open]);

  if (!open) return null;

  const toggle = (key: string) => {
    const next = columns.map((c) =>
      c.key === key ? { ...c, visible: c.visible === false ? true : false } : c
    );
    onChange(next);
  };

  const isTitle = (c: ColumnDef) => !!c.isTitle;

  const add = () => {
    const tt = title.trim();
    if (!tt) return;
    onAddColumn({ title: tt, type });
    setTitle("");
    setType("text");
  };

  return (
    <div className="ptb-modal-backdrop" role="dialog" aria-modal="true">
      <div className="ptb-modal" ref={boxRef}>
        <div className="ptb-modal-title">{t("columnManagerModal.title")}</div>
        <div className="ptb-modal-text">{t("columnManagerModal.intro")}</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Liste */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 12,
              padding: 10,
              maxHeight: 260,
              overflow: "auto",
              background: "rgba(0,0,0,0.02)",
            }}
          >
            {sorted.map((c) => {
              const checked = c.visible !== false;
              const locked = isTitle(c); // title skal alltid være synlig (vi håndhever i app-laget også)
              return (
                <label
                  key={c.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    padding: "6px 4px",
                    userSelect: "none",
                    opacity: locked ? 0.85 : 1,
                  }}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={locked}
                      onChange={() => toggle(c.key)}
                    />
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{c.title}</span>
                    {c.custom ? (
                      <span style={{ opacity: 0.75, fontSize: 12 }}>
                        {t("columnManagerModal.list.custom")}
                      </span>
                    ) : null}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Legg til */}
          <div
            style={{
              border: "1px solid rgba(0,0,0,0.10)",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 12, opacity: 0.85 }}>
              {t("columnManagerModal.add.title")}
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("columnManagerModal.add.namePlaceholder")}
                style={{
                  flex: 1,
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  padding: "0 10px",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              />
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                style={{
                  height: 34,
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.18)",
                  padding: "0 10px",
                  fontWeight: 800,
                  fontSize: 13,
                  background: "white",
                }}
              >
                <option value="text">{t("columnManagerModal.add.types.text")}</option>
                <option value="number">{t("columnManagerModal.add.types.number")}</option>
                <option value="date">{t("columnManagerModal.add.types.date")}</option>
              </select>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button type="button" className="ptb-btn ptb-btn--confirm" onClick={add}>
                {t("columnManagerModal.actions.add")}
              </button>
            </div>
          </div>
        </div>

        <div className="ptb-modal-actions" style={{ marginTop: 12 }}>
          <button type="button" className="ptb-btn ptb-btn--cancel" onClick={onClose}>
            {t("columnManagerModal.actions.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
