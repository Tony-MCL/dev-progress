// src/components/LangToggle.tsx
import React from "react";
import { useI18n, type Lang } from "../i18n";

const LANG_OPTIONS: Array<{ code: Lang; label: string; short: string }> = [
  { code: "no", label: "Norsk", short: "NO" },
  { code: "en", label: "English", short: "EN" },
  { code: "pl", label: "Polski", short: "PL" },
  { code: "de", label: "Deutsch", short: "DE" },
];

export default function LangToggle() {
  const { lang, setLang, t } = useI18n();

  const label = t("lang.aria");
  const current = LANG_OPTIONS.find((item) => item.code === lang) ?? LANG_OPTIONS[0];

  return (
    <label
      className="mcl-lang-toggle"
      aria-label={label}
      title={label}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        border: "1px solid rgba(255,255,255,0.25)",
        borderRadius: 999,
        padding: "3px 8px",
        lineHeight: 1,
        background: "transparent",
        cursor: "pointer",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: 13 }}>
        🌐
      </span>

      <select
        value={lang}
        aria-label={label}
        onChange={(e) => setLang(e.target.value as Lang)}
        style={{
          border: "none",
          background: "transparent",
          color: "inherit",
          font: "inherit",
          fontSize: 12,
          fontWeight: 700,
          outline: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {LANG_OPTIONS.map((item) => (
          <option key={item.code} value={item.code}>
            {item.short} · {item.label}
          </option>
        ))}
      </select>
    </label>
  );
}
