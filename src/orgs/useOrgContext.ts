// src/orgs/useOrgContext.ts
// Clean Build: Org/plan-context via Worker (source of truth).
// Appen leser bare status (free/trial/pro) og tar ingen betalingsbeslutninger.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { clearOptimisticPlan, getOptimisticPlan, OPTIMISTIC_PLAN_EVENT } from "./optimisticPlan";

export type ActivePlan = "free" | "trial" | "pro";

export type OrgContextState = {
  loading: boolean;
  error: string;
  memberships: any[];
  activeOrgId: string | null;
  activeRole: string | null;
  activeOrgName: string | null;
  activePlan: ActivePlan;
  expiresAt: string | null;
  setActiveOrgId: (orgId: string | null) => void;

  refresh: (opts?: { force?: boolean }) => Promise<void>;
};

type VerifyResponseAny = any;

function getApiBase(): string {
  const base = String(import.meta.env.VITE_PROGRESS_API_BASE || "").trim();
  if (!base) return "";
  return base.replace(/\/+$/g, "");
}

const CACHE_KEY = "mcl_progress_verify_cache_v1";
const CACHE_TTL_MS = 30_000;

function readCache(uid: string) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid) return null;
    if (typeof parsed.ts !== "number") return null;
    if (Date.now() - parsed.ts > CACHE_TTL_MS) return null;
    return parsed.data as VerifyResponseAny;
  } catch {
    return null;
  }
}

function writeCache(uid: string, data: VerifyResponseAny) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ uid, ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

function normalizePlan(raw: any): ActivePlan {
  const p = String(raw ?? "").toLowerCase().trim();
  if (p === "pro") return "pro";
  if (p === "trial") return "trial";
  return "free";
}

function extractFromVerify(data: VerifyResponseAny): {
  orgId: string | null;
  plan: ActivePlan;
  expiresAt: string | null;
} {
  if (!data || typeof data !== "object") {
    return { orgId: null, plan: "free", expiresAt: null };
  }

  const orgIdFlat = data?.orgId ?? data?.activeOrgId ?? null;
  const planFlat = data?.plan ?? data?.activePlan ?? data?.access?.plan ?? "free";

  const expiresFlat =
    data?.expiresAt ??
    data?.expiresAtISO ??
    data?.access?.expiresAtISO ??
    data?.access?.expiresAt ??
    null;

  const orgIdNested = (data?.org && (data.org.orgId || data.org.id)) ?? null;
  const orgId = (orgIdFlat ?? orgIdNested) ? String(orgIdFlat ?? orgIdNested) : null;

  return {
    orgId,
    plan: normalizePlan(planFlat),
    expiresAt: expiresFlat ? String(expiresFlat) : null,
  };
}

export function useOrgContext(
  uid: string | null | undefined,
  getIdToken?: (forceRefresh?: boolean) => Promise<string | null>
): OrgContextState {
  const apiBase = useMemo(() => getApiBase(), []);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [activePlan, setActivePlan] = useState<ActivePlan>("free");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const memberships = useMemo(() => [], []);

  const inflightRef = useRef<Promise<void> | null>(null);
  const lastUidRef = useRef<string | null>(null);

  // If optimistic event arrives before uid is set in this hook, we park it here.
  const pendingOptimisticRef = useRef<{ uid: string; plan: ActivePlan; ts: number } | null>(null);

  // Debounced sign-out reset to avoid auth transition flashes
  const signoutTimerRef = useRef<number | null>(null);

  const resetToFree = useCallback(() => {
    setActiveOrgId(null);
    setActivePlan("free");
    setExpiresAt(null);
  }, []);

  // Track uid transitions + debounced real sign-out
  useEffect(() => {
    const next = uid ? String(uid) : null;

    if (signoutTimerRef.current) {
      window.clearTimeout(signoutTimerRef.current);
      signoutTimerRef.current = null;
    }

    if (next) {
      lastUidRef.current = next;

      // If we had a pending optimistic event for this uid, apply it now.
      const pending = pendingOptimisticRef.current;
      if (pending && pending.uid === next) {
        setActivePlan(pending.plan);
        setError("");
        setLoading(false);
        clearCache();
      }

      return;
    }

    // uid is null: wait a bit before true reset (avoids "free flash" during transitions)
    signoutTimerRef.current = window.setTimeout(() => {
      const last = lastUidRef.current;
      if (last) clearOptimisticPlan(last);
      pendingOptimisticRef.current = null;
      resetToFree();
      setError("");
      setLoading(false);
      signoutTimerRef.current = null;
      lastUidRef.current = null;
    }, 800);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, resetToFree]);

  // ✅ Listen to optimistic-plan broadcasts for instant UI update
  useEffect(() => {
    const onEvt = (e: any) => {
      const detail = e?.detail || {};
      const euid = detail.uid ? String(detail.uid) : "";
      const plan = String(detail.plan || "").toLowerCase().trim() as ActivePlan;

      if (!euid) return;
      if (plan !== "trial" && plan !== "pro") return;

      // Park it (in case uid hasn't propagated to this hook yet)
      pendingOptimisticRef.current = { uid: euid, plan, ts: Number(detail.ts || Date.now()) };

      // If current uid matches, apply immediately.
      const cur = uid ? String(uid) : null;
      if (cur && cur === euid) {
        setActivePlan(plan);
        setError("");
        setLoading(false);
        clearCache();
        return;
      }

      // If uid isn't set yet (auth transition), still show plan immediately.
      // This is safe because it's short-lived and will be corrected by verify once uid lands.
      if (!cur) {
        setActivePlan(plan);
        setError("");
        setLoading(false);
        clearCache();
      }
    };

    window.addEventListener(OPTIMISTIC_PLAN_EVENT, onEvt as any);
    return () => window.removeEventListener(OPTIMISTIC_PLAN_EVENT, onEvt as any);
  }, [uid]);

  const applyVerify = useCallback(
    (data: VerifyResponseAny) => {
      const v = extractFromVerify(data);
      setActiveOrgId(v.orgId);
      setActivePlan(v.plan);
      setExpiresAt(v.expiresAt);

      if (uid && (v.plan === "trial" || v.plan === "pro")) {
        clearOptimisticPlan(uid);
        pendingOptimisticRef.current = null;
      }
    },
    [uid]
  );

  const fetchVerify = useCallback(
    async (token: string) => {
      const url = `${apiBase}/license/verify`;

      const tryJson = async (r: Response) => {
        const data = await r.json().catch(() => ({}));
        return data;
      };

      let r = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (r.status === 405 || r.status === 404) {
        r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ product: "progress" }),
        });
      }

      if (r.status === 401) return { ok: true, data: null as any };

      if (!r.ok) {
        const data = await tryJson(r);
        const msg = (data && (data.error || data.message)) || `verify_failed:${r.status}`;
        throw new Error(String(msg));
      }

      const data = await tryJson(r);
      return { ok: true, data };
    },
    [apiBase]
  );

  const refresh = useCallback(
    async (opts?: { force?: boolean }) => {
      const force = !!opts?.force;

      // If uid is temporarily null, don't do anything here (debounced effect handles true sign-out)
      if (!uid) {
        setError("");
        setLoading(false);
        return;
      }

      if (!apiBase || !getIdToken) {
        setError("");
        setLoading(false);
        resetToFree();
        return;
      }

      const optimistic = getOptimisticPlan(uid);
      const hasOptimistic = optimistic === "trial" || optimistic === "pro";

      if (hasOptimistic) {
        setActivePlan(optimistic);
        setError("");
        setLoading(false);
        clearCache();
      }

      if (!force && !hasOptimistic) {
        const cached = readCache(uid);
        if (cached) {
          setError("");
          setLoading(false);
          applyVerify(cached);
          return;
        }
      }

      if (inflightRef.current) {
        if (!force) return inflightRef.current;
        // force=true: vent på inflight (typisk første verify etter signup/login),
        // og kjør deretter en ny verify som fanger opp trial/pro.
        await inflightRef.current;
      }

      inflightRef.current = (async () => {
        if (!hasOptimistic) setLoading(true);
        setError("");

        try {
          let token = await getIdToken(force);
          if (!token && !force) token = await getIdToken(true);

          if (!token) {
            if (!hasOptimistic) resetToFree();
            return;
          }

          const res = await fetchVerify(token);
          if (!res.data) {
            if (!hasOptimistic) resetToFree();
            return;
          }

          const extracted = extractFromVerify(res.data);

          // If backend still says free while optimistic is active, keep optimistic and don't cache free.
          if (hasOptimistic && extracted.plan === "free") {
            return;
          }

          applyVerify(res.data);

          if (force) clearCache();
          writeCache(uid, res.data);
        } catch (e: any) {
          console.warn("[org] verify error", e);
          setError(e?.message ? String(e.message) : "verify_failed");
          if (!hasOptimistic) resetToFree();
        } finally {
          setLoading(false);
          inflightRef.current = null;
        }
      })();

      return inflightRef.current;
    },
    [uid, apiBase, getIdToken, applyVerify, fetchVerify, resetToFree]
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    loading,
    error,
    memberships,
    activeOrgId,
    activeRole: activeOrgId ? "admin" : null,
    activeOrgName: activeOrgId ? "Personal" : null,
    activePlan,
    expiresAt,
    setActiveOrgId,
    refresh,
  };
}
