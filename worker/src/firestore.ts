import { requireEnv, toFirestoreBool, toFirestoreNull, toFirestoreString, toFirestoreTimestamp } from "./util";

type Env = {
  FIREBASE_PROJECT_ID: string;
  FIREBASE_SA_JSON: string; // secret
};

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

let cachedAccessToken: { token: string; expMs: number } | null = null;

function base64Url(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  const b64 = btoa(s);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signJwtRS256(privateKeyPem: string, data: string): Promise<string> {
  // Cloudflare supports importing PKCS8 PEM directly with subtle.importKey('pkcs8')
  const pem = privateKeyPem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)).buffer;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(data)
  );
  return base64Url(new Uint8Array(sig));
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Date.now();
  if (cachedAccessToken && now < cachedAccessToken.expMs - 60_000) {
    return cachedAccessToken.token;
  }

  const sa = JSON.parse(env.FIREBASE_SA_JSON) as ServiceAccount;
  const iat = Math.floor(now / 1000);
  const exp = iat + 3600;

  const header = base64Url(new TextEncoder().encode(JSON.stringify({ alg: "RS256", typ: "JWT" })));
  const payload = base64Url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        sub: sa.client_email,
        aud: "https://oauth2.googleapis.com/token",
        iat,
        exp,
        scope: "https://www.googleapis.com/auth/datastore"
      })
    )
  );

  const signingInput = `${header}.${payload}`;
  const signature = await signJwtRS256(sa.private_key, signingInput);
  const assertion = `${signingInput}.${signature}`;

  const form = new URLSearchParams();
  form.set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer");
  form.set("assertion", assertion);

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: form.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to get access token: ${res.status} ${text}`);
  }

  const out = (await res.json()) as { access_token: string; expires_in: number };
  cachedAccessToken = { token: out.access_token, expMs: now + out.expires_in * 1000 };
  return out.access_token;
}

function fsBase(projectId: string) {
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

async function fsFetch(env: Env, path: string, init?: RequestInit) {
  const token = await getAccessToken(env);
  const res = await fetch(`${fsBase(env.FIREBASE_PROJECT_ID)}${path}`, {
    ...init,
    headers: {
      ...(init?.headers || {}),
      authorization: `Bearer ${token}`,
      "content-type": "application/json; charset=utf-8"
    }
  });
  return res;
}

export async function getDoc(env: Env, docPath: string) {
  const res = await fsFetch(env, `/${docPath}`, { method: "GET" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`getDoc failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

export async function patchDoc(env: Env, docPath: string, fields: Record<string, any>, updateMask: string[]) {
  const mask = updateMask.map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  const res = await fsFetch(env, `/${docPath}?${mask}`, {
    method: "PATCH",
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`patchDoc failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

export async function createDoc(env: Env, collectionPath: string, docId: string, fields: Record<string, any>) {
  const res = await fsFetch(env, `/${collectionPath}?documentId=${encodeURIComponent(docId)}`, {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  if (!res.ok) throw new Error(`createDoc failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as any;
}

export async function runQuery(env: Env, structuredQuery: any) {
  const res = await fsFetch(env, `:runQuery`, {
    method: "POST",
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) throw new Error(`runQuery failed ${res.status}: ${await res.text()}`);
  return (await res.json()) as any[];
}

export function fsFieldsOrgDoc(params: {
  orgNr?: string | null;
  name?: string | null;
  hidden: boolean;
  ownerUid: string;
  createdAtIso: string;
}) {
  const f: Record<string, any> = {
    hidden: toFirestoreBool(params.hidden),
    ownerUid: toFirestoreString(params.ownerUid),
    createdAt: toFirestoreTimestamp(params.createdAtIso)
  };
  if (params.orgNr) f.orgNr = toFirestoreString(params.orgNr);
  if (params.name) f.name = toFirestoreString(params.name);
  return f;
}

export function fsFieldsMember(role: "owner" | "member", addedAtIso: string) {
  return {
    role: toFirestoreString(role),
    addedAt: toFirestoreTimestamp(addedAtIso)
  };
}

export function fsFieldsUser(params: { email?: string; primaryOrgId: string; trialUsed?: boolean; createdAtIso: string }) {
  const f: Record<string, any> = {
    primaryOrgId: toFirestoreString(params.primaryOrgId),
    createdAt: toFirestoreTimestamp(params.createdAtIso)
  };
  if (params.email) f.email = toFirestoreString(params.email);
  if (typeof params.trialUsed === "boolean") f.trialUsed = { booleanValue: params.trialUsed };
  return f;
}

export function fsFieldsEntitlement(params: {
  plan: "free" | "pro";
  kind: "free" | "trial" | "paid";
  activeUntilIso: string | null;
  updatedAtIso: string;
}) {
  return {
    plan: toFirestoreString(params.plan),
    kind: toFirestoreString(params.kind),
    activeUntil: params.activeUntilIso ? toFirestoreTimestamp(params.activeUntilIso) : toFirestoreNull(),
    updatedAt: toFirestoreTimestamp(params.updatedAtIso)
  };
}

