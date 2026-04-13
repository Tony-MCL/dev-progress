// src/components/ThemeToggle.tsx
import React, { useEffect, useState } from "react";
import { useI18n } from "../i18n";

const THEME_STORAGE_KEY = "mcl-progress-theme";

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

export default function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const initial = getInitialTheme();
    applyTheme(initial);
    setTheme(initial);
  }, []);

  const applyTheme = (t: Theme) => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (t === "dark") {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
  };

  const handleToggle = () => {
    const next: Theme = theme === "light" ? "dark" : "light";
    setTheme(next);
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  };

  const label =
    theme === "light"
      ? t("theme.switchToDark")
      : t("theme.switchToLight");

  return (
    <button
      type="button"
      className="mcl-header-icon-button"
      onClick={handleToggle}
      aria-label={label}
      title={label}
    >
      <span className="mcl-theme-icon" aria-hidden="true">
        {theme === "light" ? "🌙" : "☀️"}
      </span>
    </button>
  );
}
