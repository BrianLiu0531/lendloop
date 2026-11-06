/**
 * Signed HTTP API consumed by n8n (n8n -> Convex). All /automation routes
 * require an HMAC signature (see automation/signing.ts); bodies are
 * validated with zod before reaching any mutation.
 */
import { httpRouter } from "convex/server";
import { z } from "zod";
import { internal } from "./_generated/api";
import { env, httpAction, type ActionCtx } from "./_generated/server";
import { OVERDUE_WORKFLOW } from "./automation/inbound";
import { SIGNATURE_HEADER, TIMESTAMP_HEADER, verifyInbound } from "./automation/signing";
import { addDays, isIsoDate, toIsoDate } from "./lib/dates";

const http = httpRouter();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

const isoDate = z.string().refine(isIsoDate, "must be YYYY-MM-DD");
const shortText = (max: number) => z.string().trim().min(1).max(max);

/**
 * Wraps a handler with signature verification. Verification failures get a
 * deliberately vague 401 (the precise reason only goes to the logs), so the
 * endpoint can't be used as an oracle.
 */
function signed(handler: (ctx: ActionCtx, req: { url: URL; body: unknown }) => Promise<Response>) {
  return httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const rawBody = request.method === "GET" ? "" : await request.text();
    if (rawBody.length > 64 * 1024) return json(413, { error: "Payload too large" });

    const verdict = await verifyInbound({
      secret: env.N8N_INBOUND_SIGNING_SECRET,
      method: request.method,
      pathAndQuery: url.pathname + url.search,
      rawBody,
      timestamp: request.headers.get(TIMESTAMP_HEADER),
      signature: request.headers.get(SIGNATURE_HEADER),
      nowMs: Date.now(),
    });
    if (!verdict.ok) {
      console.warn(`[http] rejected ${request.method} ${url.pathname}: ${verdict.reason}`);
      return json(401, { error: "Invalid or missing signature" });
    }

    let body: unknown = null;
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        return json(400, { error: "Body must be JSON" });
      }
    }
    return handler(ctx, { url, body });
  });
}

function badRequest(error: z.ZodError) {
  return json(400, {
    error: "Invalid request",
    issues: error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`),
  });
}

/** `asOf` must be close to the server's date so a caller can't sweep arbitrary history/future. */
function asOfInWindow(asOf: string) {
  const today = toIsoDate(Date.now());
  return asOf >= addDays(today, -2) && asOf <= addDays(today, 1);
}

http.route({
  path: "/automation/overdue-loans",
  method: "GET",
  handler: signed(async (ctx, { url }) => {
    const asOf = url.searchParams.get("asOf") ?? toIsoDate(Date.now());
    if (!isIsoDate(asOf) || !asOfInWindow(asOf)) {
      return json(400, { error: "asOf must be a YYYY-MM-DD date within a day of today" });
    }
    const result = await ctx.runQuery(internal.automation.inbound.overdueLoans, { asOf });
    return json(200, result);
  }),
});

const reminderSchema = z.object({
  loanId: shortText(64),
  asOf: isoDate,
  status: z.enum(["sent", "failed"]),
  channel: shortText(40),
  executionId: shortText(100),
  error: z.string().max(500).optional(),
});

http.route({
  path: "/automation/reminders",
  method: "POST",
  handler: signed(async (ctx, { body }) => {
    const parsed = reminderSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    const result = await ctx.runMutation(internal.automation.inbound.recordReminder, parsed.data);
    if (!result.ok) return json(result.status, { error: result.error });
    return json(200, { result: result.result, idempotencyKey: result.idempotencyKey });
  }),
});

const runSchema = z.object({
  executionId: shortText(100),
  workflow: z.literal(OVERDUE_WORKFLOW),
  asOf: isoDate,
  overdueCount: z.number().int().min(0),
  sent: z.number().int().min(0),
  failed: z.number().int().min(0),
});

http.route({
  path: "/automation/runs",
  method: "POST",
  handler: signed(async (ctx, { body }) => {
    const parsed = runSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    return json(200, await ctx.runMutation(internal.automation.inbound.recordRun, parsed.data));
  }),
});

const failureSchema = z.object({
  executionId: shortText(100),
  workflow: shortText(100),
  node: z.string().max(100).optional(),
  message: shortText(1000),
  executionUrl: z.string().url().max(500).optional(),
});

http.route({
  path: "/automation/failures",
  method: "POST",
  handler: signed(async (ctx, { body }) => {
    const parsed = failureSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error);
    return json(200, await ctx.runMutation(internal.automation.inbound.recordFailure, parsed.data));
  }),
});

/** Unauthenticated liveness probe; reveals nothing but "up". */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => json(200, { ok: true })),
});

export default http;
