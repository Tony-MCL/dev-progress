// src/auth/AuthPanel.tsx
import React, { useMemo, useState } from "react";
import "../styles/authPanel.css";

type Props = {
  onClose: () => void;

  apiBase: string; // beholdes for kompatibilitet (brukes ikke her nå)
  authReady: boolean;
  userEmail: string | null;

  plan: string;
  expiresAt: string | null;
  errorText: string | null;

  signIn: (email: string, password: string) => Promise<any>;

  // ✅ Viktig: App.tsx wrapper tar nå både register + trial/start + optimistic + refresh(force)
  register: (email: string, password: string) => Promise<any>;

  signOut: () => Promise<void>;

  getIdToken: () => Promise<string | null>; // beholdes for kompatibilitet (brukes ikke her nå)

  refreshPlan: (opts?: { force?: boolean }) => Promise<void>;
};

type Tab = "signin" | "register";

export default function AuthPanel(props: Props) {
  const {
    onClose,
    authReady,
    userEmail,
    plan,
    expiresAt,
    errorText,
    signIn,
    register,
    signOut,
    refreshPlan,
  } = props;

  const [tab, setTab] = useState<Tab>("signin");
  const [email, setEmail] = useState<string>(userEmail ?? "");
  const [password, setPassword] = useState<string>("");

  const [busy, setBusy] = useState(false);
  const [localError, setLocalError] = useState<string>("");

  const isSignedIn = !!userEmail;

  const planLabel = useMemo(() => {
    const p = String(plan || "free").toLowerCase();
    if (p === "pro") return "Pro";
    if (p === "trial") return "Trial (Pro)";
    return "Free";
  }, [plan]);

  const subtitle = useMemo(() => {
    if (!authReady) return "Loading account…";
    if (!isSignedIn) return "Sign in or register";
    if (expiresAt) {
      return `${planLabel} · expires ${new Date(expiresAt).toLocaleDateString()}`;
    }
    return planLabel;
  }, [authReady, isSignedIn, planLabel, expiresAt]);

  const showError = (localError || errorText || "").trim();

  const hardRefreshPlan = async () => {
    await refreshPlan({ force: true });
  };

  const handleRefresh = async () => {
    setLocalError("");
    setBusy(true);
    try {
      await hardRefreshPlan();
    } catch (e: any) {
      setLocalError(e?.message ?? "Refresh failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async () => {
    setLocalError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      await hardRefreshPlan();
      onClose();
    } catch (e: any) {
      setLocalError(e?.message ?? "Sign in failed");
    } finally {
      setBusy(false);
    }
  };

  const handleRegister = async () => {
    setLocalError("");
    setBusy(true);
    try {
      // ✅ App.tsx gjør: register -> trial/start -> optimistic -> refresh(force)
      await register(email.trim(), password);
      onClose();
    } catch (e: any) {
      setLocalError(e?.message ?? "Register failed");
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setLocalError("");
    setBusy(true);
    try {
      await signOut();
      await hardRefreshPlan();
      onClose();
    } catch (e: any) {
      setLocalError(e?.message ?? "Sign out failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mcl-authpanel-backdrop" role="dialog" aria-modal="true">
      <div className="mcl-authpanel-backdrop-click" onClick={onClose} />

      <div className="mcl-authpanel">
        <div className="mcl-authpanel-header">
          <div className="mcl-authpanel-titlewrap">
            <div className="mcl-authpanel-title">Account</div>
            <div className="mcl-authpanel-subtitle">{subtitle}</div>
          </div>

          <button className="mcl-authpanel-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="mcl-authpanel-body">
          {showError && <div className="mcl-authpanel-error">{showError}</div>}

          {isSignedIn ? (
            <>
              <div className="mcl-authpanel-statusbox">
                <div className="mcl-authpanel-statuslabel">Signed in as</div>
                <div className="mcl-authpanel-statusvalue">{userEmail}</div>

                <div className="mcl-authpanel-muted">
                  You are currently on <strong>{planLabel}</strong>.
                </div>

                {planLabel === "Trial (Pro)" ? (
                  <div className="mcl-authpanel-muted">
                    Trial gives full Pro access for 10 days. Trial can be started once per account.
                  </div>
                ) : null}
              </div>

              <div className="mcl-authpanel-statusbox">
                <div className="mcl-authpanel-statuslabel">Upgrade</div>
                <div className="mcl-authpanel-muted">Pro licenses are purchased via the website.</div>
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    alert("Purchase flow will be available on the website.");
                  }}
                  className="mcl-authpanel-btn"
                  style={{ alignSelf: "flex-start", marginTop: 6 }}
                >
                  Go to pricing & purchase
                </a>
              </div>

              <div className="mcl-authpanel-actions">
                <button className="mcl-authpanel-btn" onClick={handleRefresh} disabled={busy}>
                  Refresh status
                </button>
                <button className="mcl-authpanel-btn mcl-authpanel-btn-danger" onClick={handleSignOut} disabled={busy}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mcl-authpanel-tabs">
                <button
                  className={`mcl-authpanel-tabbtn ${tab === "signin" ? "mcl-authpanel-tabbtn--active" : ""}`}
                  onClick={() => setTab("signin")}
                >
                  Sign in
                </button>
                <button
                  className={`mcl-authpanel-tabbtn ${tab === "register" ? "mcl-authpanel-tabbtn--active" : ""}`}
                  onClick={() => setTab("register")}
                >
                  Register
                </button>
              </div>

              <div className="mcl-authpanel-row">
                <div className="mcl-authpanel-label">Email</div>
                <input
                  className="mcl-authpanel-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                />
              </div>

              <div className="mcl-authpanel-row">
                <div className="mcl-authpanel-label">Password</div>
                <input
                  className="mcl-authpanel-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <div className="mcl-authpanel-actions">
                {tab === "signin" ? (
                  <button
                    className="mcl-authpanel-btn mcl-authpanel-btn-primary"
                    onClick={handleSignIn}
                    disabled={busy || !email || !password}
                  >
                    Sign in
                  </button>
                ) : (
                  <button
                    className="mcl-authpanel-btn mcl-authpanel-btn-primary"
                    onClick={handleRegister}
                    disabled={busy || !email || !password}
                  >
                    Register & start trial
                  </button>
                )}
                <button className="mcl-authpanel-btn" onClick={onClose}>
                  Close
                </button>
              </div>

              <div className="mcl-authpanel-muted">
                Registering starts a <strong>10-day free Pro trial</strong>. Trial can only be activated once per account.
              </div>

              <div className="mcl-authpanel-muted">
                Pro licenses are purchased via the website. The app only verifies access.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
