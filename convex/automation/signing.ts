/**
 * HMAC-SHA256 request signing shared by both integration directions.
 *
 * Headers on every signed request:
 *   X-LendLoop-Timestamp: <unix seconds>
 *   X-LendLoop-Signature: v1=<hex hmac>
 *
 * Signed string ("base string"):
 *   Convex -> n8n (webhook):   `${timestamp}.${rawBody}`
 *   n8n -> Convex (HTTP API):  `${timestamp}.${METHOD}.${pathAndQuery}.${rawBody}`
 *
 * The inbound form binds method + path + query, so a signature captured for
 * `GET /automation/overdue-loans` can't be replayed against `POST /reminders`.
 * Each direction uses its own key, so a leaked n8n-side key can't forge
 * events from Convex and vice versa.
 *
 * Uses Web Crypto only, so it runs in Convex's default runtime (no "use node").
 */

export const SIGNATURE_HEADER = "X-LendLoop-Signature";
export const TIMESTAMP_HEADER = "X-LendLoop-Timestamp";
export const EVENT_ID_HEADER = "X-LendLoop-Event-Id";
/** Max clock skew / age accepted for a signed request. */
export const MAX_SKEW_SECONDS = 5 * 60;

const encoder = new TextEncoder();

export async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison so response timing doesn't leak a valid prefix. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function outboundBaseString(timestamp: string, rawBody: string) {
  return `${timestamp}.${rawBody}`;
}

export function inboundBaseString(timestamp: string, method: string, pathAndQuery: string, rawBody: string) {
  return `${timestamp}.${method.toUpperCase()}.${pathAndQuery}.${rawBody}`;
}

export type VerifyResult = { ok: true } | { ok: false; status: 401; reason: string };

/** Verifies an inbound (n8n -> Convex) request signature and freshness. */
export async function verifyInbound(opts: {
  secret: string | undefined;
  method: string;
  pathAndQuery: string;
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  nowMs: number;
}): Promise<VerifyResult> {
  const fail = (reason: string): VerifyResult => ({ ok: false, status: 401, reason });
  if (!opts.secret) return fail("Inbound signing secret is not configured");
  if (!opts.timestamp || !/^\d{9,11}$/.test(opts.timestamp)) return fail("Missing or malformed timestamp");
  if (!opts.signature?.startsWith("v1=")) return fail("Missing or malformed signature");

  const ageSeconds = Math.abs(opts.nowMs / 1000 - Number(opts.timestamp));
  if (ageSeconds > MAX_SKEW_SECONDS) return fail("Request timestamp outside the allowed window");

  const expected = await hmacHex(
    opts.secret,
    inboundBaseString(opts.timestamp, opts.method, opts.pathAndQuery, opts.rawBody),
  );
  return timingSafeEqual(`v1=${expected}`, opts.signature) ? { ok: true } : fail("Signature mismatch");
}

export async function signOutbound(secret: string, rawBody: string, nowMs: number) {
  const timestamp = Math.floor(nowMs / 1000).toString();
  const signature = `v1=${await hmacHex(secret, outboundBaseString(timestamp, rawBody))}`;
  return { timestamp, signature };
}
