// src/components/LangToggle.tsx
import React from "react";
import { useI18n } from "../i18n";

export default function LangToggle() {
  const { lang, setLang, t } = useI18n();

  const label = t("lang.aria");

  return (
    <div
      className="mcl-lang-toggle"
      aria-label={label}
      title={label}
    >
      <button
        type="button"
        className={"mcl-lang-button" + (lang === "no" ? " mcl-lang-button--active" : "")}
        onClick={() => setLang("no")}
      >
        NO
      </button>
      <button
        type="button"
        className={"mcl-lang-button" + (lang === "en" ? " mcl-lang-button--active" : "")}
        onClick={() => setLang("en")}
      >
        EN
      </button>
    </div>
  );
}
