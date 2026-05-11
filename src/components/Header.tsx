// src/components/Header.tsx
import React, { useEffect, useMemo, useState } from "react";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";
import PaywallModal from "../components/PaywallModal";
import { useI18n } from "../i18n";
import "../styles/header.css";

const logoUrl = new URL("../assets/mcl-logo.png", import.meta.url).href;

// ✅ Link target for logo click
const MANAGE_SYSTEM_URL = "https://managesystem.no";

type RefreshOpts = { force?: boolean };

type AccountProps = {
  apiBase: string;
  authReady: boolean;
  userEmail: string | null;
  plan: string;
  expiresAt: string | null;
  errorText: string | null;

  signIn: (email: string, password: string) => Promise<any>;
  register: (email: string, password: string) => Promise<any>;

  signOut: () => void | Promise<void>;
  getIdToken: () => Promise<string | null>;

  refreshPlan: (opts?: RefreshOpts) => void | Promise<void>;
};

type HeaderProps = {
  onToggleHelp: () => void;
  account: AccountProps;
  openTabCount?: number;
};

function normalizePlanLabel(plan: string | null | undefined) {
  const p = String(plan ?? "free").toLowerCase().trim();
  if (p === "pro") return "pro";
  if (p === "trial") return "trial";
  return "free";
}

// Worker base (kan overstyres via env)
const DEFAULT_WORKER_BASE =
  "https://gentle-wildflower-980e.morningcoffeelabs.workers.dev";
const WORKER_BASE_URL =
  (import.meta as any).env?.VITE_PROGRESS_WORKER_BASE_URL || DEFAULT_WORKER_BASE;

// Intropriser (eks mva)
const PRO_MONTH_EX_VAT = 99;
const PRO_YEAR_EX_VAT = 990;

// MVA for visning i modal
const VAT_RATE = 0.25;
const CURRENCY = "NOK";

export default function Header({ onToggleHelp, account, openTabCount = 1 }: HeaderProps) {
  const i18nAny = useI18n() as any;
  const t = i18nAny?.t ?? ((s: string) => s);

  const lang =
    (i18nAny?.lang as string) ||
    (i18nAny?.language as string) ||
    (i18nAny?.currentLang as string) ||
    "no";

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallMode, setPaywallMode] = useState<"trial" | "buy">("trial");

  const helpLabel = t("header.help");
  const accountBtnLabel = t("header.account");
  const openTabsTitle = t("toolbar.multiTab.title");
  const openTabsLabel = t("toolbar.multiTab.openTabs");

  const planLabel = useMemo(() => {
    return normalizePlanLabel(account.plan);
  }, [account.plan]);

  const upsellText = t("header.upsell");

  const pillText = useMemo(() => {
    if (!account.userEmail) return upsellText;

    const parts: string[] = [];
    parts.push(`${t("header.plan")}: ${planLabel}`);
    if (account.expiresAt) {
      parts.push(
        `${t("header.expires")}: ${account.expiresAt}`
      );
    }
    return parts.join(" · ");
  }, [account.userEmail, upsellText, planLabel, account.expiresAt, isNo]);

  const pillTitle = useMemo(() => {
    if (!account.userEmail) return upsellText;
    if (account.errorText) {
      return `${t("header.statusError")}: ${account.errorText}`;
    }

    return t("header.planStatusTitle");

  const pillIcon = useMemo(() => {
    if (!account.userEmail) return "✨";
    if (account.errorText) return "⚠️";
    if (planLabel === "pro") return "✅";
    if (planLabel === "trial") return "🧪";
    return "🆓";
  }, [account.userEmail, account.errorText, planLabel]);

  const accountTitle = useMemo(() => {
    if (!account.authReady) return t("header.accountLoading");
    if (!account.userEmail) return t("header.account");
    const plan = String(account.plan || "").toUpperCase();
    return `${plan || "ACCOUNT"} · ${account.userEmail}`;
  }, [account.authReady, account.userEmail, account.plan, t]);

  // ✅ wrappers som alltid gir Promise<void>
  const signOut = async () => {
    await Promise.resolve(account.signOut());
  };

  const refreshPlan = async (opts?: RefreshOpts) => {
    await Promise.resolve(account.refreshPlan(opts));
  };

  // ✅ Refresh once when returning from website checkout.
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const from = (url.searchParams.get("from") || "").toLowerCase();
      const refresh = url.searchParams.get("refresh");

      const shouldRefresh = from === "checkout" || refresh === "1";
      if (!shouldRefresh) return;

      if (!account.userEmail) return;

      void refreshPlan({ force: true }).finally(() => {
        url.searchParams.delete("from");
        url.searchParams.delete("refresh");
        window.history.replaceState({}, "", url.toString());
      });
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account.userEmail]);

  function openPaywallFromHeader() {
    const nextMode: "trial" | "buy" =
      !account.userEmail || planLabel === "free" ? "trial" : "buy";

    setPaywallMode(nextMode);
    setPaywallOpen(true);
  }

  const logoTitle = t("header.logoTitle");

  return (
    <header className="mcl-header">
      <div className="mcl-header-inner">
        <div className="mcl-header-left">
          <div className="mcl-logo-wrap" style={{ position: "relative" }}>
            {/* ✅ Keep image EXACTLY as before */}
            <img src={logoUrl} alt="App logo" className="mcl-logo" />

            {/* ✅ Add a transparent overlay link (does not affect layout) */}
            <a
              href={MANAGE_SYSTEM_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={logoTitle}
              aria-label={logoTitle}
              style={{
                position: "absolute",
                inset: 0,
                display: "block",
                cursor: "pointer",
                // No background, purely clickable overlay
                background: "transparent",
              }}
            />
          </div>
        </div>

        <div className="mcl-header-right" style={{ position: "relative" }}>
          <LangToggle />
          <ThemeToggle />

          <div
            title={pillTitle}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 12px",
              borderRadius: 999,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.25)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
              fontSize: 12,
              lineHeight: 1,
              maxWidth: 520,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              opacity: 0.95,
              cursor: "default",
            }}
          >
            <span aria-hidden="true">{pillIcon}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
              {pillText}
            </span>
          </div>

          {planLabel === "pro" && openTabCount > 1 ? (
            <div
              title={openTabsTitle}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                borderRadius: 999,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.25)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.10)",
                fontSize: 12,
                lineHeight: 1,
                opacity: 0.95,
                whiteSpace: "nowrap",
              }}
            >
              <span aria-hidden="true">🗂️</span>
              <span>
                {openTabsLabel}: {openTabCount}
              </span>
            </div>
          ) : null}

          <button
            type="button"
            className="mcl-header-icon-button"
            title={accountTitle}
            onClick={openPaywallFromHeader}
          >
            <span aria-hidden="true">👤</span>
            <span className="mcl-header-icon-label">{accountBtnLabel}</span>
          </button>

          <PaywallModal
            open={paywallOpen}
            mode={paywallMode}
            onClose={() => setPaywallOpen(false)}
            lang={lang}
            workerBaseUrl={WORKER_BASE_URL}
            priceMonthExVat={PRO_MONTH_EX_VAT}
            priceYearExVat={PRO_YEAR_EX_VAT}
            vatRate={VAT_RATE}
            currency={CURRENCY}
          />

          <button
            type="button"
            className="mcl-header-icon-button"
            onClick={onToggleHelp}
            aria-label={helpLabel}
            title={helpLabel}
          >
            <span aria-hidden="true">❓</span>
            <span className="mcl-header-icon-label">{helpLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
