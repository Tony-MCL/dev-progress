// src/orgs/optimisticPlan.ts
// UX-bridge: short-lived optimistic plan state keyed by uid.
// Also broadcasts a custom event so the UI can update instantly without reload.

import type { ActivePlan } from "./useOrgContext";

type OptimisticRecord = {
  uid: string;
  plan: ActivePlan;
  ts: number;
  ttlMs: number;
};

const KEY = "mcl_progress_optimistic_plan_v1";
const EVT = "mcl:optimistic-plan";

export function setOptimisticPlan(uid: string, plan: ActivePlan, ttlMs = 90_000) {
  try {
    const rec: OptimisticRecord = { uid, plan, ts: Date.now(), ttlMs };
    localStorage.setItem(KEY, JSON.stringify(rec));

    // ✅ Broadcast so hooks/UI can react immediately (even if auth uid hasn't propagated yet)
    window.dispatchEvent(new CustomEvent(EVT, { detail: { uid, plan, ts: rec.ts, ttlMs } }));
  } catch {
    // ignore
  }
}

export function getOptimisticPlan(uid: string): ActivePlan | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const rec = JSON.parse(raw) as Partial<OptimisticRecord>;
    if (!rec || rec.uid !== uid) return null;
    if (typeof rec.ts !== "number") return null;
    const ttl = typeof rec.ttlMs === "number" ? rec.ttlMs : 0;
    if (!ttl) return null;
    if (Date.now() - rec.ts > ttl) return null;

    const p = String(rec.plan ?? "").toLowerCase().trim();
    if (p === "trial") return "trial";
    if (p === "pro") return "pro";
    return "free";
  } catch {
    return null;
  }
}

export function clearOptimisticPlan(uid?: string) {
  try {
    if (!uid) {
      localStorage.removeItem(KEY);
      return;
    }
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const rec = JSON.parse(raw) as Partial<OptimisticRecord>;
    if (rec && rec.uid === uid) localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

// Optional: export event name for listeners
export const OPTIMISTIC_PLAN_EVENT = EVT;
