export type StripeEnv = {
  STRIPE_SECRET_KEY: string; // secret
  STRIPE_WEBHOOK_SECRET: string; // secret
  STRIPE_PRICE_MONTH: string;
  STRIPE_PRICE_YEAR: string;
};

export async function createCheckoutSession(env: StripeEnv, params: {
  interval: "month" | "year";
  customerEmail?: string;
  orgId: string;
  orgNr?: string | null;
  successUrl: string;
  cancelUrl: string;
}) {
  const price = params.interval === "year" ? env.STRIPE_PRICE_YEAR : env.STRIPE_PRICE_MONTH;

  const form = new URLSearchParams();
  form.set("mode", "subscription");
  form.set("success_url", params.successUrl);
  form.set("cancel_url", params.cancelUrl);

  form.set("line_items[0][price]", price);
  form.set("line_items[0][quantity]", "1");

  if (params.customerEmail) form.set("customer_email", params.customerEmail);

  // Metadata to link back to org
  form.set("metadata[product]", "progress");
  form.set("metadata[orgId]", params.orgId);
  if (params.orgNr) form.set("metadata[orgNr]", params.orgNr);

  // Ask Stripe to create subscription metadata too
  form.set("subscription_data[metadata][product]", "progress");
  form.set("subscription_data[metadata][orgId]", params.orgId);
  if (params.orgNr) form.set("subscription_data[metadata][orgNr]", params.orgNr);

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded"
    },
    body: form.toString()
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stripe create session failed: ${res.status} ${text}`);
  }
  const data = await res.json() as any;
  return { url: data.url as string, id: data.id as string };
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function hmacSha256(key: string, msg: string | ArrayBuffer) {
  const k = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const data = typeof msg === "string" ? new TextEncoder().encode(msg) : new Uint8Array(msg);
  const sig = await crypto.subtle.sign("HMAC", k, data);
  return new Uint8Array(sig);
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// Verifies stripe-signature header and returns parsed event JSON if valid.
export async function verifyStripeWebhook(env: StripeEnv, rawBody: ArrayBuffer, sigHeader: string) {
  // sigHeader example: "t=...,v1=...,v0=..."
  const parts = sigHeader.split(",").map((s) => s.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Part = parts.find((p) => p.startsWith("v1="));
  if (!tPart || !v1Part) throw new Error("Invalid stripe-signature header");

  const timestamp = tPart.slice(2);
  const sigHex = v1Part.slice(3);

  // Optional: reject old timestamps (5 min)
  const t = parseInt(timestamp, 10);
  if (!Number.isFinite(t)) throw new Error("Bad timestamp");
  const age = Math.abs(Date.now() - t * 1000);
  if (age > 5 * 60 * 1000) throw new Error("Webhook timestamp too old");

  const signedPayload = `${timestamp}.${new TextDecoder().decode(rawBody)}`;
  const computed = await hmacSha256(env.STRIPE_WEBHOOK_SECRET, signedPayload);

  const provided = hexToBytes(sigHex);
  if (!timingSafeEqual(computed, provided)) throw new Error("Invalid webhook signature");

  const event = JSON.parse(new TextDecoder().decode(rawBody));
  return event;
}

export async function fetchStripeSubscription(env: StripeEnv, subscriptionId: string) {
  const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subscriptionId}`, {
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  if (!res.ok) throw new Error(`Stripe subscription fetch failed: ${res.status} ${await res.text()}`);
  return await res.json() as any;
}
