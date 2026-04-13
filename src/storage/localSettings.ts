// src/storage/localSettings.ts

export function lsReadString(key: string, fallback: string | null = null) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : String(v);
  } catch {
    return fallback;
  }
}

export function lsWriteString(key: string, value: string | null | undefined) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    // ignore
  }
}

export function lsReadNumber(
  key: string,
  fallback: number,
  opts?: { min?: number; max?: number }
) {
  const raw = lsReadString(key, null);
  const n = raw === null ? NaN : Number(raw);
  if (!Number.isFinite(n)) return fallback;

  let out = n;
  if (typeof opts?.min === "number") out = Math.max(opts.min, out);
  if (typeof opts?.max === "number") out = Math.min(opts.max, out);
  return out;
}

export function lsWriteNumber(key: string, value: number) {
  lsWriteString(key, String(value));
}

export function lsReadBool(key: string, fallback: boolean) {
  const raw = lsReadString(key, null);
  if (raw === null) return fallback;
  return raw === "true";
}

export function lsWriteBool(key: string, value: boolean) {
  lsWriteString(key, value ? "true" : "false");
}
