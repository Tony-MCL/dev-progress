// src/components/PaywallModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { initializeApp, getApps } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

type Mode = "trial" | "buy";
type ViewMode = "login" | "account" | Mode;

type BillingPeriod = "month" | "year";
type PurchaseType = "subscription" | "one_time";

type Props = {
  open: boolean;
  mode: Mode;
  onClose: () => void;

  lang: string; // "no" | "en"
  workerBaseUrl: string;

  // Pricing (ex VAT) shown in modal
  priceMonthExVat: number; // e.g. 129
  priceYearExVat: number; // e.g. 1290
  vatRate: number; // e.g. 0.25 (ikke brukt nå – salg er unntatt mva per nå)

  currency: string; // "NOK"
};

function clampUrlBase(u: string) {
  return (u || "").replace(/\/+$/, "");
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function getIsDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

function roundKr(v: number) {
  return Math.round(v);
}

function formatKr(n: number, lang: string) {
  const r = roundKr(n);
  const isNo = lang === "no";
  return isNo ? `${r} kr` : `${r} NOK`;
}

function normalizeOrgNr(s: string) {
  return (s || "").replace(/\s+/g, "").trim();
}

function isProbablyOrgNr(s: string) {
  const x = normalizeOrgNr(s);
  return !x || /^\d{9}$/.test(x);
}

function normalizePublicHashBase(raw: string) {
  const base = String(raw || "").trim();
  if (!base) return "";
  const withSlash = base.replace(/\/+$/, "/");
  if (withSlash.includes("#/")) return withSlash;
  return withSlash.replace(/\/+$/, "") + "/#/";
}

// ----------------------------
// Firebase init (minimal)
// ----------------------------
function getFirebaseConfig() {
  const apiKey = String(import.meta.env.VITE_FIREBASE_API_KEY || "");
  const authDomain = String(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "");
  const projectId = String(import.meta.env.VITE_FIREBASE_PROJECT_ID || "");
  const appId = String(import.meta.env.VITE_FIREBASE_APP_ID || "");

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "Missing Firebase env vars. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, VITE_FIREBASE_PROJECT_ID."
    );
  }

  return appId ? { apiKey, authDomain, projectId, appId } : { apiKey, authDomain, projectId };
}

function ensureFirebase() {
  if (getApps().length) return;
  initializeApp(getFirebaseConfig());
}

function isAuthEmailInUse(err: any) {
  const code = String(err?.code || "");
  return code === "auth/email-already-in-use";
}

function isAuthInvalidLogin(err: any) {
  const code = String(err?.code || "");
  return (
    code === "auth/invalid-credential" ||
    code === "auth/wrong-password" ||
    code === "auth/user-not-found"
  );
}

// Used by trial/checkout flows (create if new, else sign-in)
async function ensureSignedInAndGetToken(email: string, password: string) {
  ensureFirebase();
  const auth = getAuth();

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken(true);
    return token;
  } catch (e: any) {
    if (isAuthEmailInUse(e)) {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken(true);
      return token;
    }

    if (isAuthInvalidLogin(e)) {
      throw new Error("INVALID_LOGIN");
    }

    throw e;
  }
}

// Used by login-only flow (sign-in only, no create)
async function signInOnlyAndGetToken(email: string, password: string) {
  ensureFirebase();
  const auth = getAuth();
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const token = await cred.user.getIdToken(true);
    return token;
  } catch (e: any) {
    if (isAuthInvalidLogin(e)) {
      throw new Error("INVALID_LOGIN");
    }
    throw e;
  }
}

const PaywallModal: React.FC<Props> = ({
  open,
  mode,
  onClose,
  lang,
  workerBaseUrl,
  priceMonthExVat,
  priceYearExVat,
  // vatRate er bevisst ikke brukt nå (salg er unntatt mva per nå)
  currency,
}) => {
  const isNo = lang === "no";

  // ============================
  // ROUTES (Worker)
  // ============================
  const ROUTE_TRIAL_START = "/api/trial/start";
  const ROUTE_CHECKOUT_CREATE = "/api/checkout/create";
  // ============================

  const workerBase = useMemo(() => clampUrlBase(workerBaseUrl), [workerBaseUrl]);

  const [viewMode, setViewMode] = useState<ViewMode>("login");

  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);

  const [password, setPassword] = useState("");
  const [passwordTouched, setPasswordTouched] = useState(false);

  type BuyerType = "company" | "private";
  const [buyerType, setBuyerType] = useState<BuyerType>("company");

  // Company fields
  const [orgName, setOrgName] = useState("");
  const [orgNr, setOrgNr] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");

  // Private fields
  const [fullName, setFullName] = useState("");
  const [country, setCountry] = useState("");

  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("month");
  const [purchaseType, setPurchaseType] = useState<PurchaseType>("subscription");

  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [portalReady, setPortalReady] = useState(false);
  useEffect(() => {
    setPortalReady(typeof document !== "undefined" && !!document.body);
  }, []);

  // Når modalen lukkes: nullstill UI-state, så neste åpning starter "rent"
  useEffect(() => {
    if (open) return;

    setBusy(false);
    setStatus(null);
    setError(null);

    setEmailTouched(false);
    setPasswordTouched(false);

    setEmail("");
    setPassword("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia?.("(max-width: 720px)")?.matches ?? false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia?.("(max-width: 720px)");
    if (!mq) return;
    const onChange = () => setIsNarrow(mq.matches);
    onChange();
    if ((mq as any).addEventListener) (mq as any).addEventListener("change", onChange);
    else (mq as any).addListener?.(onChange);
    return () => {
      if ((mq as any).removeEventListener) (mq as any).removeEventListener("change", onChange);
      else (mq as any).removeListener?.(onChange);
    };
  }, []);

  const [isDark, setIsDark] = useState(() => getIsDarkTheme());
  useEffect(() => {
    if (!open) return;

    setIsDark(getIsDarkTheme());

    const el = document.documentElement;
    const obs = new MutationObserver(() => {
      setIsDark(getIsDarkTheme());
    });
    obs.observe(el, { attributes: true, attributeFilter: ["data-theme"] });

    return () => obs.disconnect();
  }, [open]);

  // ✅ Viktig: når modalen åpner -> alltid login, med mindre allerede innlogget -> account
  useEffect(() => {
    if (!open) return;

    setStatus(null);
    setError(null);
    setBusy(false);

    setEmailTouched(false);
    setPasswordTouched(false);

    // Keep purchase defaults predictable
    setBillingPeriod("month");
    setPurchaseType("subscription");
    setBuyerType("company");

    ensureFirebase();
    const auth = getAuth();
    const u = auth.currentUser;

    if (u) {
      setViewMode("account");
    } else {
      setViewMode("login");
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const t = {
    close: isNo ? "Lukk" : "Close",

    tabLogin: isNo ? "Logg inn" : "Sign in",
    tabAccount: isNo ? "Konto" : "Account",
    tabTrial: isNo ? "Trial" : "Trial",
    tabBuy: isNo ? "Kjøp lisens" : "Buy license",

    emailLabel: isNo ? "E-postadresse" : "Email address",
    passwordLabel: isNo ? "Passord" : "Password",

    buyerCompany: isNo ? "Bedrift" : "Company",
    buyerPrivate: isNo ? "Privat" : "Private",

    orgName: isNo ? "Firmanavn" : "Company name",
    orgNr: isNo ? "Org.nr" : "Org number",
    contactName: isNo ? "Kontaktperson" : "Contact person",
    phone: isNo ? "Telefon" : "Phone",

    fullName: isNo ? "Navn" : "Full name",
    country: isNo ? "Land" : "Country",

    trialTitle: isNo ? "Prøv Fullversjon gratis i 10 dager" : "Try Full version free for 10 days",
    trialBody: isNo
      ? "Skriv inn e-post og passord for å starte prøveperioden."
      : "Enter email and password to start the trial.",
    startTrial: isNo ? "Start prøveperiode" : "Start trial",

    buyTitle: isNo ? "Kjøp lisens for Fullversjon" : "Buy Full version license",
    buyBody: isNo
      ? "Fyll inn informasjon én gang, velg lisenstype og gå til betaling."
      : "Fill in the details once, choose license type, and proceed to checkout.",

    loginTitle: isNo ? "Logg inn" : "Sign in",
    loginBody: isNo
      ? "Skriv inn e-post og passord for å logge inn på kontoen din."
      : "Enter email and password to sign in to your account.",
    signIn: isNo ? "Logg inn" : "Sign in",

    accountTitle: isNo ? "Konto" : "Account",
    accountBody: isNo
      ? "Du er innlogget. Her kan du logge ut eller gå til Trial / Kjøp lisens ved behov."
      : "You are signed in. You can sign out, or go to Trial / Buy license if needed.",
    signedInAs: isNo ? "Innlogget som:" : "Signed in as:",
    signOut: isNo ? "Logg ut" : "Sign out",

    licenseType: isNo ? "Lisenstype" : "License type",
    subscription: isNo ? "Abonnement" : "Subscription",
    oneTime: isNo ? "Enkeltkjøp" : "One-time",

    payCadence: isNo ? "Med betaling:" : "With billing:",
    month: isNo ? "Månedlig" : "Monthly",
    year: isNo ? "Årlig" : "Yearly",

    duration: isNo ? "Varighet" : "Duration",
    oneMonth: isNo ? "1 måned" : "1 month",
    oneYear: isNo ? "1 år" : "1 year",

    calcPrice: isNo ? "Pris" : "Price",
    calcTotal: isNo ? "Total" : "Total",

    perMonth: isNo ? "kr/mnd" : "NOK/mo",
    perYear: isNo ? "kr/år" : "NOK/yr",

    goToCheckout: isNo ? "Gå til betaling" : "Go to checkout",

    invalidEmail: isNo ? "Skriv inn en gyldig e-postadresse." : "Enter a valid email address.",
    invalidPassword: isNo ? "Passord må være minst 6 tegn." : "Password must be at least 6 characters.",
    missingCompany: isNo ? "Fyll inn alle påkrevde felt." : "Fill in all required fields.",
    invalidOrgNr: isNo ? "Org.nr ser ikke riktig ut (9 siffer)." : "Org number looks wrong (9 digits).",

    networkError: isNo
      ? "Noe gikk galt. Sjekk at Worker-endepunktene er riktige."
      : "Something went wrong. Check that the Worker endpoints are correct.",

    wrongEndpoint: isNo
      ? "Det ser ut som checkout-kallet går til feil adresse (ikke Worker). Sjekk Worker-url i miljøvariabler."
      : "It looks like the checkout call is hitting the wrong address (not the Worker). Check the Worker URL env var.",

    invalidLogin: isNo
      ? "Kunne ikke logge inn. Sjekk e-post og passord."
      : "Could not sign in. Check email and password.",

    signedInOk: isNo ? "Du er nå logget inn." : "You are now signed in.",
    signedOutOk: isNo ? "Du er nå logget ut." : "You are now signed out.",

    vatNoticeLine1: isNo ? "Salg er for tiden unntatt merverdiavgift." : "Sales are currently exempt from VAT.",
    vatNoticeLine2: isNo
      ? "Når registreringsgrensen nås, vil 25 % merverdiavgift bli lagt til i henhold til norsk regelverk."
      : "Once the registration threshold is reached, 25% VAT will be added in accordance with Norwegian regulations.",
  };

  const emailOk = isValidEmail(email);
  const passwordOk = password.trim().length >= 6;

  const showEmailError = emailTouched && !emailOk;
  const showPasswordError = passwordTouched && !passwordOk;

  const orgNrOk = isProbablyOrgNr(orgNr);

  const companyOk =
    buyerType === "company"
      ? Boolean(
          orgName.trim() &&
            normalizeOrgNr(orgNr) &&
            contactName.trim() &&
            phone.trim() &&
            orgNrOk
        )
      : true;

  const privateOk = buyerType === "private" ? Boolean(fullName.trim() && country.trim()) : true;

  const buyOk = viewMode === "buy" ? companyOk && privateOk : true;

  // ✅ MVA deaktivert: pris = total
  const selectedExVat = billingPeriod === "month" ? priceMonthExVat : priceYearExVat;
  const selectedTotal = selectedExVat;

  const title =
    viewMode === "trial"
      ? t.trialTitle
      : viewMode === "buy"
      ? t.buyTitle
      : viewMode === "account"
      ? t.accountTitle
      : t.loginTitle;

  const sub =
    viewMode === "trial"
      ? t.trialBody
      : viewMode === "buy"
      ? t.buyBody
      : viewMode === "account"
      ? t.accountBody
      : t.loginBody;

  async function startTrial() {
    setEmailTouched(true);
    setPasswordTouched(true);
    setStatus(null);
    setError(null);

    if (!emailOk) return;
    if (!passwordOk) return;

    setBusy(true);
    try {
      const token = await ensureSignedInAndGetToken(email.trim(), password);

      const endpoint = `${workerBase}${ROUTE_TRIAL_START}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          product: "progress",
          lang,
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `HTTP ${res.status}`);
      }

      setStatus(
        isNo
          ? "Prøveperiode er startet. Du kan nå bruke Fullversjon-funksjoner i 10 dager."
          : "Trial started. You can now use full-version features for 10 days."
      );
    } catch (e: any) {
      if (String(e?.message || "") === "INVALID_LOGIN") {
        setError(t.invalidLogin);
      } else {
        setError(e?.message || t.networkError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function goToCheckout() {
    setEmailTouched(true);
    setPasswordTouched(true);
    setStatus(null);
    setError(null);

    if (!emailOk) return;
    if (!passwordOk) return;

    if (!buyOk) {
      if (buyerType === "company" && !orgNrOk) setError(t.invalidOrgNr);
      else setError(t.missingCompany);
      return;
    }

    setBusy(true);
    try {
      const token = await ensureSignedInAndGetToken(email.trim(), password);

      const rawPublic =
        (import.meta as any).env?.VITE_PUBLIC_SITE_URL ||
        `${window.location.origin}${window.location.pathname}`;

      const publicBase = normalizePublicHashBase(rawPublic);
      const successUrl = `${publicBase}progress/checkout?from=checkout&success=1`;
      const cancelUrl = `${publicBase}progress/checkout?from=checkout&canceled=1`;

      const payload: any = {
        lang,
        billingPeriod,
        purchaseType,
        successUrl,
        cancelUrl,
        quantity: 1,
        tier: "intro",
      };

      if (buyerType === "company") {
        payload.orgName = orgName.trim();
        payload.orgNr = normalizeOrgNr(orgNr);
        payload.contactName = contactName.trim();
        payload.phone = phone.trim();
        payload.buyerType = "company";
      } else {
        payload.orgName = fullName.trim();
        payload.orgNr = null;
        payload.contactName = fullName.trim();
        payload.phone = phone.trim() || null;
        payload.country = country.trim();
        payload.buyerType = "private";
      }

      const endpoint = `${workerBase}${ROUTE_CHECKOUT_CREATE}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        const looksLikeHtml = /<html|<!doctype/i.test(txt);
        if (looksLikeHtml) {
          throw new Error(`${t.wrongEndpoint}\nHTTP ${res.status} @ ${endpoint}`);
        }
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json().catch(() => null);
      const url = data?.url || data?.checkoutUrl;

      if (!url || typeof url !== "string") {
        throw new Error(
          isNo
            ? "Worker returnerte ingen checkout-url (forventet { url })."
            : "Worker returned no checkout url (expected { url })."
        );
      }

      window.location.assign(url);
    } catch (e: any) {
      if (String(e?.message || "") === "INVALID_LOGIN") {
        setError(t.invalidLogin);
      } else {
        setError(e?.message || t.networkError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function signInOnly() {
    setEmailTouched(true);
    setPasswordTouched(true);
    setStatus(null);
    setError(null);

    if (!emailOk) return;
    if (!passwordOk) return;

    setBusy(true);
    try {
      await signInOnlyAndGetToken(email.trim(), password);
      setStatus(t.signedInOk);

      // etter innlogging: vis konto-siden (ikke kjøp/trial)
      setPassword("");
      setPasswordTouched(false);
      setViewMode("account");
    } catch (e: any) {
      if (String(e?.message || "") === "INVALID_LOGIN") {
        setError(t.invalidLogin);
      } else {
        setError(e?.message || t.networkError);
      }
    } finally {
      setBusy(false);
    }
  }

  async function doSignOut() {
    setStatus(null);
    setError(null);
    setBusy(true);
    try {
      ensureFirebase();
      const auth = getAuth();
      await signOut(auth);

      setStatus(t.signedOutOk);
      setViewMode("login");
      setEmail("");
      setPassword("");
      setEmailTouched(false);
      setPasswordTouched(false);
    } catch (e: any) {
      setError(e?.message || t.networkError);
    } finally {
      setBusy(false);
    }
  }

  const overlayBg = isDark ? "rgba(0,0,0,0.86)" : "rgba(0,0,0,0.45)";
  const overlayBlur = isDark ? "blur(10px)" : "blur(6px)";

  const panelBg = "var(--mcl-surface)";
  const panelBorder = "1px solid var(--mcl-border)";
  const panelShadow = isDark ? "0 18px 60px rgba(0,0,0,0.55)" : "0 18px 60px rgba(0,0,0,0.20)";

  const line = isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid rgba(0,0,0,0.10)";

  const inputBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)";
  const chipBorder = isDark ? "1px solid rgba(255,255,255,0.20)" : "1px solid rgba(0,0,0,0.16)";

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontWeight: 600,
    marginBottom: 6,
  };

  const inputStyle = (errorBorder?: boolean): React.CSSProperties => ({
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box",
    padding: "0.7rem 0.8rem",
    borderRadius: 12,
    border: errorBorder ? "1px solid rgba(255,80,80,0.75)" : chipBorder,
    background: inputBg,
    color: "inherit",
    outline: "none",
  });

  const sectionTitleStyle: React.CSSProperties = {
    fontWeight: 650,
    marginBottom: 10,
  };

  const actionBtnStyle: React.CSSProperties = {
    width: isNarrow ? "100%" : "auto",
    padding: "0.8rem 1rem",
    borderRadius: 12,
    border: chipBorder,
    background: "transparent",
    color: "inherit",
    cursor: busy ? "default" : "pointer",
    fontWeight: 650,
  };

  const radioRowStyle: React.CSSProperties = {
    display: "flex",
    gap: 14,
    flexWrap: "wrap",
    alignItems: "center",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: "0.45rem 0.7rem",
    borderRadius: 999,
    border: chipBorder,
    background: active ? inputBg : "transparent",
    color: "inherit",
    cursor: busy ? "default" : "pointer",
    fontWeight: 650,
    lineHeight: 1,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  });

  // For konto-visning: hent epost hvis innlogget
  let signedInEmail = "";
  try {
    ensureFirebase();
    signedInEmail = getAuth().currentUser?.email || "";
  } catch {
    signedInEmail = "";
  }

  const modalUi = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: overlayBg,
        backdropFilter: overlayBlur,
        WebkitBackdropFilter: overlayBlur,
        zIndex: 9999,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "1rem",
        overflow: "hidden",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(760px, 100%)",
          maxHeight: "min(86vh, 820px)",
          display: "flex",
          flexDirection: "column",
          borderRadius: 16,
          overflow: "hidden",
          background: panelBg,
          border: panelBorder,
          boxShadow: panelShadow,
          color: "var(--mcl-text)",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "flex-start",
            justifyContent: "space-between",
            padding: "0.9rem 1rem",
            borderBottom: line,
            boxSizing: "border-box",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            {/* "Tabs": skjul aktiv knapp, vis resten. Rekkefølge: Konto/Logg inn -> Trial -> Kjøp */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {viewMode !== "account" && signedInEmail && (
                <button type="button" onClick={() => setViewMode("account")} disabled={busy} style={tabBtn(false)}>
                  {t.tabAccount}
                </button>
              )}

              {viewMode !== "login" && !signedInEmail && (
                <button type="button" onClick={() => setViewMode("login")} disabled={busy} style={tabBtn(false)}>
                  {t.tabLogin}
                </button>
              )}

              {viewMode !== "trial" && (
                <button type="button" onClick={() => setViewMode("trial")} disabled={busy} style={tabBtn(false)}>
                  {t.tabTrial}
                </button>
              )}

              {viewMode !== "buy" && (
                <button type="button" onClick={() => setViewMode("buy")} disabled={busy} style={tabBtn(false)}>
                  {t.tabBuy}
                </button>
              )}
            </div>

            <div style={{ fontSize: 16, fontWeight: 650 }}>{title}</div>
            <div style={{ fontSize: 13, opacity: 0.8, color: "var(--mcl-text-dim)" }}>{sub}</div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "0.45rem 0.7rem",
              borderRadius: 10,
              border: chipBorder,
              background: inputBg,
              color: "inherit",
              cursor: "pointer",
              flex: "0 0 auto",
              height: 36,
              fontWeight: 600,
              boxSizing: "border-box",
            }}
          >
            {t.close}
          </button>
        </div>

        <div style={{ padding: "1rem", overflowY: "auto", overflowX: "hidden", boxSizing: "border-box" }}>
          {/* Konto */}
          {viewMode === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {signedInEmail ? (
                <div style={{ fontSize: 14 }}>
                  <div style={{ opacity: 0.8, marginBottom: 6 }}>{t.signedInAs}</div>
                  <div style={{ fontWeight: 700 }}>{signedInEmail}</div>
                </div>
              ) : (
                <div style={{ fontSize: 14, opacity: 0.9 }}>
                  {isNo ? "Du er ikke innlogget." : "You are not signed in."}
                </div>
              )}

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {signedInEmail ? (
                  <button type="button" onClick={doSignOut} disabled={busy} style={actionBtnStyle}>
                    {t.signOut}
                  </button>
                ) : (
                  <button type="button" onClick={() => setViewMode("login")} disabled={busy} style={actionBtnStyle}>
                    {t.signIn}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Login */}
          {viewMode === "login" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                  gap: 12,
                  marginBottom: "0.9rem",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{t.emailLabel}</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder={isNo ? "navn@firma.no" : "name@company.com"}
                    style={inputStyle(showEmailError)}
                  />
                  {showEmailError && (
                    <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>{t.invalidEmail}</div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{t.passwordLabel}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder={isNo ? "Minst 6 tegn" : "At least 6 characters"}
                    style={inputStyle(showPasswordError)}
                  />
                  {showPasswordError && (
                    <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>{t.invalidPassword}</div>
                  )}
                </div>
              </div>

              <button type="button" onClick={signInOnly} disabled={busy} style={actionBtnStyle}>
                {t.signIn}
              </button>
            </>
          )}

          {/* Trial + Buy bruker samme input-rad som før, så vi gjenbruker den */}
          {(viewMode === "trial" || viewMode === "buy") && (
            <>
              {viewMode === "buy" && (
                <div style={{ marginBottom: "0.85rem" }}>
                  <div style={radioRowStyle}>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="buyerType"
                        checked={buyerType === "company"}
                        onChange={() => setBuyerType("company")}
                      />
                      {t.buyerCompany}
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="buyerType"
                        checked={buyerType === "private"}
                        onChange={() => setBuyerType("private")}
                      />
                      {t.buyerPrivate}
                    </label>
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                  gap: 12,
                  marginBottom: "0.9rem",
                  boxSizing: "border-box",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{t.emailLabel}</label>
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onBlur={() => setEmailTouched(true)}
                    placeholder={isNo ? "navn@firma.no" : "name@company.com"}
                    style={inputStyle(showEmailError)}
                  />
                  {showEmailError && (
                    <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>{t.invalidEmail}</div>
                  )}
                </div>

                <div style={{ minWidth: 0 }}>
                  <label style={labelStyle}>{t.passwordLabel}</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setPasswordTouched(true)}
                    placeholder={isNo ? "Minst 6 tegn" : "At least 6 characters"}
                    style={inputStyle(showPasswordError)}
                  />
                  {showPasswordError && (
                    <div style={{ fontSize: 13, marginTop: 6, opacity: 0.95 }}>{t.invalidPassword}</div>
                  )}
                </div>
              </div>

              {viewMode === "buy" && buyerType === "company" && (
                <div style={{ marginBottom: "0.95rem" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                      gap: 12,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.orgName}</label>
                      <input
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        placeholder={isNo ? "Firma AS" : "Company Ltd"}
                        style={inputStyle(false)}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.orgNr}</label>
                      <input
                        value={orgNr}
                        onChange={(e) => setOrgNr(e.target.value)}
                        placeholder={isNo ? "9 siffer" : "9 digits"}
                        style={inputStyle(!orgNrOk)}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.contactName}</label>
                      <input
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        placeholder={isNo ? "Ola Nordmann" : "Jane Doe"}
                        style={inputStyle(false)}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.phone}</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={isNo ? "+47 ..." : "+47 ..."}
                        style={inputStyle(false)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "buy" && buyerType === "private" && (
                <div style={{ marginBottom: "0.95rem" }}>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
                      gap: 12,
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.fullName}</label>
                      <input
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder={isNo ? "Ola Nordmann" : "Jane Doe"}
                        style={inputStyle(false)}
                      />
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <label style={labelStyle}>{t.country}</label>
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder={isNo ? "Norge" : "Norway"}
                        style={inputStyle(false)}
                      />
                    </div>

                    <div style={{ gridColumn: "1 / -1", minWidth: 0 }}>
                      <label style={labelStyle}>{t.phone}</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={isNo ? "+47 ..." : "+47 ..."}
                        style={inputStyle(false)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {viewMode === "trial" ? (
                <button type="button" onClick={startTrial} disabled={busy} style={actionBtnStyle}>
                  {t.startTrial}
                </button>
              ) : (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: isNarrow ? "1fr" : "1fr minmax(220px, 300px)",
                      gap: "1rem",
                      alignItems: "start",
                      boxSizing: "border-box",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ marginBottom: "0.95rem" }}>
                        <div style={sectionTitleStyle}>{t.licenseType}</div>
                        <div style={radioRowStyle}>
                          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="radio"
                              name="purchaseType"
                              checked={purchaseType === "subscription"}
                              onChange={() => setPurchaseType("subscription")}
                            />
                            {t.subscription}
                          </label>
                          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <input
                              type="radio"
                              name="purchaseType"
                              checked={purchaseType === "one_time"}
                              onChange={() => setPurchaseType("one_time")}
                            />
                            {t.oneTime}
                          </label>
                        </div>
                      </div>

                      {purchaseType === "subscription" ? (
                        <div>
                          <div style={sectionTitleStyle}>{t.payCadence}</div>
                          <div style={radioRowStyle}>
                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name="billingPeriod"
                                checked={billingPeriod === "month"}
                                onChange={() => setBillingPeriod("month")}
                              />
                              {t.month}
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name="billingPeriod"
                                checked={billingPeriod === "year"}
                                onChange={() => setBillingPeriod("year")}
                              />
                              {t.year}
                            </label>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div style={sectionTitleStyle}>{t.duration}</div>
                          <div style={radioRowStyle}>
                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name="billingPeriod"
                                checked={billingPeriod === "month"}
                                onChange={() => setBillingPeriod("month")}
                              />
                              {t.oneMonth}
                            </label>
                            <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              <input
                                type="radio"
                                name="billingPeriod"
                                checked={billingPeriod === "year"}
                                onChange={() => setBillingPeriod("year")}
                              />
                              {t.oneYear}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      style={{
                        minWidth: 0,
                        border: chipBorder,
                        background: inputBg,
                        borderRadius: 12,
                        padding: "0.85rem 0.9rem",
                        boxSizing: "border-box",
                      }}
                    >
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr auto",
                          rowGap: 8,
                          columnGap: 14,
                          alignItems: "baseline",
                          fontSize: 13.5,
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{t.calcPrice}:</div>
                        <div style={{ textAlign: "right", fontWeight: 650 }}>
                          {formatKr(selectedExVat, lang)}
                        </div>

                        <div style={{ fontWeight: 650 }}>{t.calcTotal}:</div>
                        <div style={{ textAlign: "right", fontWeight: 700 }}>
                          {formatKr(selectedTotal, lang)}
                          {purchaseType === "subscription" &&
                            (billingPeriod === "year" ? ` ${t.perYear}` : ` ${t.perMonth}`)}
                        </div>
                      </div>

                      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>{currency}</div>

                      {/* ✅ MVA-notis */}
                      <div
                        style={{
                          marginTop: 10,
                          fontSize: 12,
                          lineHeight: 1.4,
                          color: "var(--mcl-text-dim)",
                        }}
                      >
                        <div>{t.vatNoticeLine1}</div>
                        <div>{t.vatNoticeLine2}</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ marginTop: "1.1rem" }}>
                    <button type="button" onClick={goToCheckout} disabled={busy} style={actionBtnStyle}>
                      {t.goToCheckout}
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {(status || error) && (
            <div
              style={{
                marginTop: "1rem",
                padding: "0.75rem 0.9rem",
                borderRadius: 12,
                border: chipBorder,
                background: inputBg,
                opacity: 0.98,
              }}
            >
              {error ? <div>{error}</div> : <div>{status}</div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!portalReady) return modalUi;
  return createPortal(modalUi, document.body);
};

export default PaywallModal;
