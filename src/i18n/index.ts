// src/i18n/index.ts
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import no from "./no";
import en from "./en";
import pl from "./pl";
import de from "./de";

export type Lang = "no" | "en" | "pl" | "de";

type Dict = Record<string, any>;

const STORAGE_KEY = "mcl-progress-lang";

function isSupportedLang(value: string | null): value is Lang {
  return value === "no" || value === "en" || value === "pl" || value === "de";
}

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "no";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return isSupportedLang(v) ? v : "no";
}

function getByPath(obj: Dict, path: string): unknown {
  const parts = path.split(".");
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

const missingLogged = new Set<string>();

function makeT(dict: Dict, lang: Lang) {
  return (key: string): string => {
    const v = getByPath(dict, key);

    if (typeof v === "string") return v;

    if (typeof import.meta !== "undefined" && (import.meta as any).env?.DEV) {
      const id = `${lang}:${key}`;
      if (!missingLogged.has(id)) {
        missingLogged.add(id);
        console.warn(`[i18n] Missing key: ${key} (lang=${lang})`);
      }
    }

    return key;
  };
}

type I18nCtx = {
  lang: Lang;
  setLang: (next: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nCtx | null>(null);

export function I18nProvider(props: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang());

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, lang);
    }
  }, [lang]);

  const dict = useMemo(() => {
    if (lang === "en") return en;
    if (lang === "pl") return pl;
    if (lang === "de") return de;
    return no;
  }, [lang]);

  const value = useMemo<I18nCtx>(() => {
    return {
      lang,
      setLang: setLangState,
      t: makeT(dict, lang),
    };
  }, [dict, lang]);

  return React.createElement(I18nContext.Provider, { value }, props.children);
}

export function useI18n(): I18nCtx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
