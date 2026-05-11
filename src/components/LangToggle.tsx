// src/components/LangToggle.tsx
import React from "react";
import { useI18n, type Lang } from "../i18n";

const LANG_OPTIONS: Array<{ code: Lang; label: string }> = [
  { code: "no", label: "NO" },
  { code: "en", label: "EN" },
  { code: "pl", label: "PL" },
  { code: "de", label: "DE" },
];

export default function LangToggle() {
  const { lang, setLang, t } = useI18n();

  const label = t("lang.aria");

  return (
    <div className="mcl-lang-toggle" aria-label={label} title={label}>
      {LANG_OPTIONS.map((item) => (
        <button
          key={item.code}
          type="button"
          className={
            "mcl-lang-button" +
            (lang === item.code ? " mcl-lang-button--active" : "")
          }
          onClick={() => setLang(item.code)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
