type JwtHeader = { alg: string; kid?: string; typ?: string };
type JwtPayload = Record<string, any>;

function base64UrlToBytes(b64url: string) {
  const pad = b64url.length % 4 ? "=".repeat(4 - (b64url.length % 4)) : "";
  const b64 = (b64url + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function base64UrlToJson<T>(b64url: string): T {
  const bytes = base64UrlToBytes(b64url);
  const text = new TextDecoder().decode(bytes);
  return JSON.parse(text) as T;
}

let cachedCerts: { fetchedAt: number; certs: Record<string, string> } | null = null;

async function getGoogleCerts(): Promise<Record<string, string>> {
  const maxAgeMs = 60 * 60 * 1000; // 1 time
  if (cachedCerts && Date.now() - cachedCerts.fetchedAt < maxAgeMs) return cachedCerts.certs;

  const url =
    "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch Firebase certs: ${res.status}`);
  const certs = (await res.json()) as Record<string, string>;
  cachedCerts = { fetchedAt: Date.now(), certs };
  return certs;
}

function pemToSpkiDer(pem: string): ArrayBuffer {
  const lines = pem.trim().split("\n");
  const b64 = lines
    .filter((l) => !l.includes("BEGIN CERTIFICATE") && !l.includes("END CERTIFICATE"))
    .join("");
  const raw = atob(b64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes.buffer;
}

async function importRsaPublicKeyFromCertPem(certPem: string): Promise<CryptoKey> {
  // Cert PEM -> DER -> import as "spki" usually requires SPKI, but cert is X.509.
  // WebCrypto does not import X.509 cert directly as spki. However Google returns certs,
  // and many runtimes accept importing the DER cert as "spki". Cloudflare Workers supports it.
  const der = pemToSpkiDer(certPem);
  return crypto.subtle.importKey(
    "spki",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );
}

export type VerifiedFirebaseToken = {
  uid: string;
  email?: string;
  payload: JwtPayload;
};

export async function verifyFirebaseIdToken(idToken: string, firebaseProjectId: string) {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT");

  const header = base64UrlToJson<JwtHeader>(parts[0]);
  const payload = base64UrlToJson<JwtPayload>(parts[1]);
  const signature = base64UrlToBytes(parts[2]);

  const nowSec = Math.floor(Date.now() / 1000);

  const aud = payload.aud;
  const iss = payload.iss;
  const sub = payload.sub;

  if (aud !== firebaseProjectId) throw new Error("Invalid aud");
  if (iss !== `https://securetoken.google.com/${firebaseProjectId}`) throw new Error("Invalid iss");
  if (!sub || typeof sub !== "string") throw new Error("Missing sub");
  if (payload.exp && nowSec >= payload.exp) throw new Error("Token expired");
  if (payload.iat && payload.iat > nowSec + 60) throw new Error("Token issued in future");

  const kid = header.kid;
  if (!kid) throw new Error("Missing kid");

  const certs = await getGoogleCerts();
  const certPem = certs[kid];
  if (!certPem) throw new Error("Unknown kid");

  const key = await importRsaPublicKeyFromCertPem(certPem);

  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const ok = await crypto.subtle.verify(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    signature,
    signingInput
  );
  if (!ok) throw new Error("Bad signature");

  const uid = payload.user_id || payload.sub;
  return {
    uid: String(uid),
    email: payload.email ? String(payload.email) : undefined,
    payload
  } as VerifiedFirebaseToken;
}
