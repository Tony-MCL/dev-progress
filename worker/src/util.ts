export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function badRequest(message: string, extra?: any) {
  return json({ ok: false, error: "BAD_REQUEST", message, ...extra }, { status: 400 });
}

export function unauthorized(message = "Unauthorized") {
  return json({ ok: false, error: "UNAUTHORIZED", message }, { status: 401 });
}

export function conflict(error: string, message: string) {
  return json({ ok: false, error, message }, { status: 409 });
}

export function methodNotAllowed() {
  return json({ ok: false, error: "METHOD_NOT_ALLOWED" }, { status: 405 });
}

export function parseBearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function addCors(req: Request, res: Response, allowedOriginsCsv: string) {
  const origin = req.headers.get("origin") || "";
  const allowed = allowedOriginsCsv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const headers = new Headers(res.headers);

  if (allowed.includes(origin)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("vary", "Origin");
  }

  headers.set("access-control-allow-headers", "authorization, content-type, stripe-signature");
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-max-age", "86400");

  return new Response(res.body, { ...res, headers });
}

export async function readJson<T = any>(req: Request): Promise<T | null> {
  const ct = req.headers.get("content-type") || "";
  if (!ct.includes("application/json")) return null;
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

export function nowMs() {
  return Date.now();
}

export function daysFromNowMs(days: number) {
  return nowMs() + days * 24 * 60 * 60 * 1000;
}

export function isoFromMs(ms: number) {
  return new Date(ms).toISOString();
}

export function requireEnv(value: string | undefined, name: string) {
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

export function toFirestoreTimestamp(iso: string) {
  // Firestore REST "timestampValue"
  return { timestampValue: iso };
}

export function toFirestoreString(s: string) {
  return { stringValue: s };
}

export function toFirestoreBool(b: boolean) {
  return { booleanValue: b };
}

export function toFirestoreNull() {
  return { nullValue: null };
}

export function toFirestoreInt(n: number) {
  return { integerValue: String(Math.trunc(n)) };
}

