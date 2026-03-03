import { verifyFirebaseIdToken } from "./firebaseJwt";
import {
  addCors,
  badRequest,
  conflict,
  daysFromNowMs,
  isoFromMs,
  json,
  methodNotAllowed,
  parseBearer,
  readJson,
  unauthorized
} from "./util";
import {
  createDoc,
  fsFieldsEntitlement,
  fsFieldsMember,
  fsFieldsOrgDoc,
  fsFieldsUser,
  getDoc,
  patchDoc,
  runQuery
} from "./firestore";
import { createCheckoutSession, fetchStripeSubscription, verifyStripeWebhook } from "./stripe";

type Env = {
  PRODUCT_ID: string;
  TRIAL_DAYS: string;
  RETENTION_DAYS: string;

  FIREBASE_PROJECT_ID: string;
  FIREBASE_SA_JSON: string; // secret

  STRIPE_SECRET_KEY: string; // secret
  STRIPE_WEBHOOK_SECRET: string; // secret
  STRIPE_PRICE_MONTH: string;
  STRIPE_PRICE_YEAR: string;

  ALLOWED_ORIGINS: string;
};

function envNumber(v: string, fallback: number) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

function orgsCollection() {
  return "orgs";
}

async function findOrgByOrgNr(env: Env, orgNr: string): Promise<string | null> {
  const q = {
    from: [{ collectionId: "orgs" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "orgNr" },
        op: "EQUAL",
        value: { stringValue: orgNr }
      }
    },
    limit: 1
  };
  const rows = await runQuery(env as any, q);
  for (const r of rows) {
    const doc = r.document;
    if (!doc?.name) continue;
    // doc.name ends with ".../documents/orgs/{orgId}"
    const parts = String(doc.name).split("/");
    return parts[parts.length - 1] || null;
  }
  return null;
}

function docPath(...parts: string[]) {
  return parts.join("/");
}

function newId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

async function ensureUserDoc(env: Env, uid: string, email: string | undefined, primaryOrgId: string, setTrialUsed?: boolean) {
  const path = docPath("users", uid);
  const existing = await getDoc(env as any, path);
  const iso = isoFromMs(Date.now());

  if (!existing) {
    await createDoc(env as any, "users", uid, fsFieldsUser({ email, primaryOrgId, trialUsed: !!setTrialUsed, createdAtIso: iso }));
    return { trialUsed: !!setTrialUsed };
  }

  const fields = existing.fields || {};
  const trialUsed = fields.trialUsed?.booleanValue === true;

  const update: Record<string, any> = {};
  const mask: string[] = [];

  // Keep primaryOrgId updated
  update.primaryOrgId = { stringValue: primaryOrgId };
  mask.push("primaryOrgId");

  if (email && !fields.email?.stringValue) {
    update.email = { stringValue: email };
    mask.push("email");
  }
  if (setTrialUsed && !trialUsed) {
    update.trialUsed = { booleanValue: true };
    mask.push("trialUsed");
  }

  if (mask.length > 0) await patchDoc(env as any, path, update, mask);
  return { trialUsed };
}

async function ensureOrgAndMembership(env: Env, params: {
  uid: string;
  orgNr?: string | null;
  orgName?: string | null;
  hidden: boolean;
}) {
  let orgId: string | null = null;

  if (params.orgNr) {
    orgId = await findOrgByOrgNr(env, params.orgNr);
  }

  if (!orgId) {
    orgId = newId("ORG");
    const iso = isoFromMs(Date.now());
    await createDoc(
      env as any,
      "orgs",
      orgId,
      fsFieldsOrgDoc({
        orgNr: params.orgNr || null,
        name: params.orgName || null,
        hidden: params.hidden,
        ownerUid: params.uid,
        createdAtIso: iso
      })
    );
  }

  // Ensure member doc exists for uid
  const memberPath = docPath("orgs", orgId, "members", params.uid);
  const memberExisting = await getDoc(env as any, memberPath);
  if (!memberExisting) {
    await createDoc(env as any, docPath("orgs", orgId, "members"), params.uid, fsFieldsMember("owner", isoFromMs(Date.now())));
  }

  return orgId;
}

async function setEntitlement(env: Env, orgId: string, plan: "free" | "pro", kind: "free" | "trial" | "paid", activeUntilIso: string | null) {
  const path = docPath("orgs", orgId, "entitlements", "progress");
  const iso = isoFromMs(Date.now());

  const existing = await getDoc(env as any, path);
  const fields = fsFieldsEntitlement({ plan, kind, activeUntilIso, updatedAtIso: iso });

  if (!existing) {
    await createDoc(env as any, docPath("orgs", orgId, "entitlements"), "progress", fields);
  } else {
    await patchDoc(env as any, path, fields, ["plan", "kind", "activeUntil", "updatedAt"]);
  }
}

async function getUserPrimaryOrgId(env: Env, uid: string): Promise<string | null> {
  const u = await getDoc(env as any, docPath("users", uid));
  if (!u?.fields?.primaryOrgId?.stringValue) return null;
  return String(u.fields.primaryOrgId.stringValue);
}

async function getEntitlement(env: Env, orgId: string) {
  const e = await getDoc(env as any, docPath("orgs", orgId, "entitlements", "progress"));
  if (!e?.fields) return null;

  const f = e.fields;
  const plan = f.plan?.stringValue as string | undefined;
  const kind = f.kind?.stringValue as string | undefined;
  const activeUntil = f.activeUntil?.timestampValue ? String(f.activeUntil.timestampValue) : null;

  return { plan, kind, activeUntil };
}

/**
 * Minimal "archive all projects" for org.
 * (In v1 we keep it simple. Can be optimized later.)
 */
async function archiveOrgProjects(env: Env, orgId: string, retentionDays: number) {
  // Query active projects (archived == false)
  const q = {
    from: [{ collectionId: "projects", parent: `projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/orgs/${orgId}` }],
  };

  // Firestore REST structured query can't easily target subcollection via parent here using this minimal helper,
  // so we will use a normal collection query on the subcollection path:
  // We'll runQuery against "orgs/{orgId}/projects"
  const query = {
    from: [{ collectionId: "projects" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "archived" },
        op: "EQUAL",
        value: { booleanValue: false }
      }
    },
    limit: 200
  };

  // Run query with parent by using the documents:runQuery endpoint doesn't accept parent in our helper,
  // so we do a workaround: use collectionGroup would be bigger.
  // For v1: we skip mass-archive and let UI rely on entitlement.
  // (We still keep purge cron for archived docs.)
  // NOTE: This is intentionally a no-op to avoid accidental cross-org updates.
  void q; void query;

  // Practical v1 approach:
  // - Access is blocked by entitlement (rules) immediately.
  // - Archiving can be done later or via a dedicated admin job.
  // We'll keep purge cron based on purgeAt for docs that were archived.
}

async function purgeArchivedProjects(env: Env, retentionDays: number) {
  // Minimal v1 purge: we do not scan all orgs here.
  // This can be extended later with an index collection or per-org scan list.
  // For now, the retention mechanism exists in schema and can be wired up once you decide how to index orgs.
  void env; void retentionDays;
}

function accessFree() {
  return {
    ok: true,
    access: { plan: "free", kind: "free", orgId: null, expiresAt: null }
  };
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return addCors(req, new Response(null, { status: 204 }), env.ALLOWED_ORIGINS);
    }

    try {
      // ---- POST /trial/start ----
      if (url.pathname === "/trial/start") {
        if (req.method !== "POST") return addCors(req, methodNotAllowed(), env.ALLOWED_ORIGINS);

        const token = parseBearer(req);
        if (!token) return addCors(req, unauthorized("Missing bearer token"), env.ALLOWED_ORIGINS);

        const verified = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
        const body = (await readJson<{ product?: string; orgNr?: string; orgName?: string }>(req)) || {};
        if ((body.product || "progress") !== "progress") return addCors(req, badRequest("Invalid product"), env.ALLOWED_ORIGINS);

        // Check trialUsed
        const userDoc = await getDoc(env as any, docPath("users", verified.uid));
        const alreadyUsed = userDoc?.fields?.trialUsed?.booleanValue === true;
        if (alreadyUsed) {
          return addCors(req, conflict("TRIAL_ALREADY_USED", "Trial has already been used for this user."), env.ALLOWED_ORIGINS);
        }

        const trialDays = envNumber(env.TRIAL_DAYS, 10);
        const expiresAtIso = isoFromMs(daysFromNowMs(trialDays));

        // Org: if orgNr is provided => org for that orgNr, else hidden org
        const orgId = await ensureOrgAndMembership(env, {
          uid: verified.uid,
          orgNr: body.orgNr?.trim() || null,
          orgName: body.orgName?.trim() || null,
          hidden: !body.orgNr
        });

        // User doc
        await ensureUserDoc(env, verified.uid, verified.email, orgId, true);

        // License doc (optional for v1, but nice for audit)
        const licenseId = newId("LIC");
        const licensePath = docPath("orgs", orgId, "licenses");
        const createdAtIso = isoFromMs(Date.now());
        await createDoc(env as any, licensePath, licenseId, {
          product: { stringValue: "progress" },
          status: { stringValue: "trial" },
          source: { stringValue: "trial" },
          expiresAt: { timestampValue: expiresAtIso },
          createdAt: { timestampValue: createdAtIso },
          updatedAt: { timestampValue: createdAtIso }
        });

        // Entitlement summary
        await setEntitlement(env, orgId, "pro", "trial", expiresAtIso);

        const out = {
          ok: true,
          access: { plan: "pro", kind: "trial", orgId, expiresAt: expiresAtIso }
        };

        return addCors(req, json(out), env.ALLOWED_ORIGINS);
      }

      // ---- GET /license/verify ----
      if (url.pathname === "/license/verify") {
        if (req.method !== "GET" && req.method !== "POST") return addCors(req, methodNotAllowed(), env.ALLOWED_ORIGINS);

        const token = parseBearer(req);
        if (!token) return addCors(req, json(accessFree()), env.ALLOWED_ORIGINS);

        let verified: { uid: string; email?: string };
        try {
          verified = await verifyFirebaseIdToken(token, env.FIREBASE_PROJECT_ID);
        } catch {
          return addCors(req, unauthorized("Invalid token"), env.ALLOWED_ORIGINS);
        }

        const orgId = await getUserPrimaryOrgId(env, verified.uid);
        if (!orgId) return addCors(req, json(accessFree()), env.ALLOWED_ORIGINS);

        const ent = await getEntitlement(env, orgId);
        if (!ent || ent.plan !== "pro") return addCors(req, json(accessFree()), env.ALLOWED_ORIGINS);

        // activeUntil can be null, but in v1 we expect it for trial/subscription
        const expiresAt = ent.activeUntil ?? null;
        const kind = (ent.kind === "trial" || ent.kind === "paid") ? ent.kind : "paid";

        return addCors(
          req,
          json({ ok: true, access: { plan: "pro", kind, orgId, expiresAt } }),
          env.ALLOWED_ORIGINS
        );
      }

      // ---- POST /checkout/create ----
      if (url.pathname === "/checkout/create") {
        if (req.method !== "POST") return addCors(req, methodNotAllowed(), env.ALLOWED_ORIGINS);

        const body = (await readJson<any>(req)) || {};
        const interval = body.interval === "year" ? "year" : "month";
        const successUrl = String(body.successUrl || "");
        const cancelUrl = String(body.cancelUrl || "");
        if (!successUrl || !cancelUrl) return addCors(req, badRequest("Missing successUrl/cancelUrl"), env.ALLOWED_ORIGINS);

        const orgNr = body.orgNr ? String(body.orgNr).trim() : null;
        const orgName = body.orgName ? String(body.orgName).trim() : null;
        const customerEmail = body.customerEmail ? String(body.customerEmail).trim() : undefined;

        // Create/find org. Purchase without orgNr => hidden org.
        const orgId = await ensureOrgAndMembership(env, {
          uid: "SYSTEM", // owner unknown at purchase time; can be re-owned later
          orgNr,
          orgName,
          hidden: !orgNr
        });

        const { url: checkoutUrl } = await createCheckoutSession(env as any, {
          interval,
          customerEmail,
          orgId,
          orgNr,
          successUrl,
          cancelUrl
        });

        return addCors(req, json({ ok: true, checkoutUrl }), env.ALLOWED_ORIGINS);
      }

      // ---- POST /stripe/webhook ----
      if (url.pathname === "/stripe/webhook") {
        if (req.method !== "POST") return addCors(req, methodNotAllowed(), env.ALLOWED_ORIGINS);

        const sig = req.headers.get("stripe-signature");
        if (!sig) return addCors(req, unauthorized("Missing stripe-signature"), env.ALLOWED_ORIGINS);

        const raw = await req.arrayBuffer();
        let event: any;
        try {
          event = await verifyStripeWebhook(env as any, raw, sig);
        } catch (e: any) {
          return addCors(req, json({ ok: false, error: "BAD_WEBHOOK_SIGNATURE", message: String(e?.message || e) }, { status: 400 }), env.ALLOWED_ORIGINS);
        }

        ctx.waitUntil(handleStripeEvent(event, env));

        return addCors(req, json({ received: true }), env.ALLOWED_ORIGINS);
      }

      return addCors(req, json({ ok: false, error: "NOT_FOUND" }, { status: 404 }), env.ALLOWED_ORIGINS);
    } catch (e: any) {
      return addCors(
        req,
        json({ ok: false, error: "INTERNAL", message: String(e?.message || e) }, { status: 500 }),
        env.ALLOWED_ORIGINS
      );
    }
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const retentionDays = envNumber(env.RETENTION_DAYS, 90);
    ctx.waitUntil(purgeArchivedProjects(env, retentionDays));
  }
};

async function handleStripeEvent(event: any, env: Env) {
  const type = String(event.type || "");
  const obj = event.data?.object;

  // We key org from metadata orgId
  const meta = obj?.metadata || {};
  const orgId = meta.orgId ? String(meta.orgId) : null;
  if (!orgId) return;

  const nowIso = new Date().toISOString();

  if (type === "checkout.session.completed") {
    // For subscriptions, session has subscription id
    const subscriptionId = obj?.subscription ? String(obj.subscription) : null;
    const customerId = obj?.customer ? String(obj.customer) : null;

    if (subscriptionId) {
      const sub = await fetchStripeSubscription(env as any, subscriptionId);
      const periodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null;

      // Update entitlement
      await setEntitlement(env, orgId, "pro", "paid", periodEnd);

      // Write/update a license doc (simple: one active license per org)
      const licenseId = "stripe"; // stable id for v1
      const licensePath = docPath("orgs", orgId, "licenses", licenseId);

      const existing = await getDoc(env as any, licensePath);
      const fields: Record<string, any> = {
        product: { stringValue: "progress" },
        status: { stringValue: "active" },
        source: { stringValue: "stripe" },
        expiresAt: periodEnd ? { timestampValue: periodEnd } : { nullValue: null },
        stripeCustomerId: customerId ? { stringValue: customerId } : { nullValue: null },
        stripeSubscriptionId: { stringValue: subscriptionId },
        updatedAt: { timestampValue: nowIso }
      };

      if (!existing) {
        fields.createdAt = { timestampValue: nowIso };
        await createDoc(env as any, docPath("orgs", orgId, "licenses"), licenseId, fields);
      } else {
        await patchDoc(env as any, licensePath, fields, Object.keys(fields));
      }
    }
    return;
  }

  if (type === "customer.subscription.updated" || type === "customer.subscription.deleted") {
    const subscriptionId = obj?.id ? String(obj.id) : null;
    const customerId = obj?.customer ? String(obj.customer) : null;

    const status = obj?.status ? String(obj.status) : "";
    const periodEnd = obj?.current_period_end ? new Date(obj.current_period_end * 1000).toISOString() : null;

    const isActive = status === "active" || status === "trialing" || status === "past_due";

    if (isActive) {
      await setEntitlement(env, orgId, "pro", "paid", periodEnd);
    } else {
      await setEntitlement(env, orgId, "free", "free", null);
      // Access will be blocked immediately by rules. Archiving can be done later.
      await archiveOrgProjects(env, orgId, parseInt(env.RETENTION_DAYS || "90", 10) || 90);
    }

    // Update stable license doc
    const licenseId = "stripe";
    const licensePath = docPath("orgs", orgId, "licenses", licenseId);

    const fields: Record<string, any> = {
      product: { stringValue: "progress" },
      status: { stringValue: isActive ? "active" : "canceled" },
      source: { stringValue: "stripe" },
      expiresAt: periodEnd ? { timestampValue: periodEnd } : { nullValue: null },
      stripeCustomerId: customerId ? { stringValue: customerId } : { nullValue: null },
      stripeSubscriptionId: subscriptionId ? { stringValue: subscriptionId } : { nullValue: null },
      updatedAt: { timestampValue: nowIso }
    };

    const existing = await getDoc(env as any, licensePath);
    if (!existing) {
      fields.createdAt = { timestampValue: nowIso };
      await createDoc(env as any, docPath("orgs", orgId, "licenses"), licenseId, fields);
    } else {
      await patchDoc(env as any, licensePath, fields, Object.keys(fields));
    }
    return;
  }

  // Ignore other events for v1
}
