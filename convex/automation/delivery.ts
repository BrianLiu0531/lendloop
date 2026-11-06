/**
 * Outbox delivery: Convex -> n8n "loan event" webhook.
 *
 *   mutation (state change + outbox row)  ──scheduler──▶  deliver (action)
 *        deliver: build minimal payload → sign → POST (20s timeout)
 *          2xx              → delivered
 *          408/429/5xx/net  → retrying, re-scheduled with exponential backoff
 *          other 4xx        → dead immediately (retrying a rejected signature won't help)
 *          attempts ≥ MAX   → dead
 *   dead events surface on the admin Automation page and can be re-driven.
 *
 * Delivery is at-least-once; the payload's eventId is the idempotency key
 * the n8n workflow dedupes on, so a retry after a lost 200 can't double-notify.
 */
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { env, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { publicName } from "../lib/privacy";
import { EVENT_ID_HEADER, SIGNATURE_HEADER, TIMESTAMP_HEADER, signOutbound } from "./signing";

export const MAX_ATTEMPTS = 6;
const BACKOFF_MS = [10_000, 30_000, 120_000, 600_000, 1_800_000];
// Longer than n8n's own quick SMTP retry (2 tries × 2s), so we don't abort a run that is about to succeed.
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * Builds the webhook payload. Data minimization: the recipient's email
 * (needed to notify them) plus first names, tool name and dates. No
 * descriptions, no free-text request messages, no counterpart contact
 * details — the email links back to the app for anything more.
 */
export const loadForDelivery = internalQuery({
  args: { outboxId: v.id("outbox") },
  handler: async (ctx, { outboxId }) => {
    const event = await ctx.db.get("outbox", outboxId);
    if (!event || event.status === "delivered" || event.status === "dead") return null;
    const loan = await ctx.db.get("loans", event.loanId);
    if (!loan) return null;
    const [tool, recipient] = await Promise.all([
      ctx.db.get("tools", loan.toolId),
      ctx.db.get("users", event.recipientId),
    ]);
    const counterpart = await ctx.db.get(
      "users",
      event.recipientRole === "lender" ? loan.borrowerId : loan.lenderId,
    );
    const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return {
      attempts: event.attempts,
      payload: {
        eventId: event.eventId,
        type: event.type,
        occurredAt: new Date(event._creationTime).toISOString(),
        recipient: {
          role: event.recipientRole,
          name: publicName(recipient),
          email: recipient?.email ?? null,
        },
        counterpart: { name: publicName(counterpart) },
        tool: { name: tool?.name ?? "a tool" },
        loan: {
          id: loan._id,
          status: loan.status,
          startDate: loan.startDate,
          endDate: loan.endDate,
          url: `${appUrl}${event.recipientRole === "lender" ? "/me/incoming" : "/me/requests"}?loan=${loan._id}`,
        },
      },
    };
  },
});

export const deliver = internalAction({
  args: { outboxId: v.id("outbox") },
  returns: v.null(),
  handler: async (ctx, { outboxId }) => {
    const job = await ctx.runQuery(internal.automation.delivery.loadForDelivery, { outboxId });
    if (!job) return null;

    const url = env.N8N_LOAN_EVENTS_WEBHOOK_URL;
    const secret = env.N8N_OUTBOUND_SIGNING_SECRET;
    if (!url || !secret) {
      await ctx.runMutation(internal.automation.delivery.recordAttempt, {
        outboxId,
        outcome: "retryable",
        error: "Automation not configured (N8N_LOAN_EVENTS_WEBHOOK_URL / N8N_OUTBOUND_SIGNING_SECRET)",
      });
      return null;
    }
    if (!job.payload.recipient.email) {
      await ctx.runMutation(internal.automation.delivery.recordAttempt, {
        outboxId,
        outcome: "permanent",
        error: "Recipient has no email address on file",
      });
      return null;
    }

    const body = JSON.stringify(job.payload);
    const { timestamp, signature } = await signOutbound(secret, body, Date.now());
    let outcome: "delivered" | "retryable" | "permanent";
    let error: string | undefined;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [TIMESTAMP_HEADER]: timestamp,
          [SIGNATURE_HEADER]: signature,
          [EVENT_ID_HEADER]: job.payload.eventId,
        },
        body,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (res.ok) {
        outcome = "delivered";
      } else {
        const text = (await res.text().catch(() => "")).slice(0, 200);
        error = `HTTP ${res.status}${text ? `: ${text}` : ""}`;
        outcome = res.status === 408 || res.status === 429 || res.status >= 500 ? "retryable" : "permanent";
      }
    } catch (e) {
      outcome = "retryable";
      error = e instanceof Error ? `${e.name}: ${e.message}` : "Network error";
    }
    await ctx.runMutation(internal.automation.delivery.recordAttempt, { outboxId, outcome, error });
    return null;
  },
});

export const recordAttempt = internalMutation({
  args: {
    outboxId: v.id("outbox"),
    outcome: v.union(v.literal("delivered"), v.literal("retryable"), v.literal("permanent")),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { outboxId, outcome, error }) => {
    const event = await ctx.db.get("outbox", outboxId);
    if (!event || event.status === "delivered") return null;
    const now = Date.now();
    const attempts = event.attempts + 1;

    if (outcome === "delivered") {
      await ctx.db.patch("outbox", outboxId, {
        status: "delivered",
        attempts,
        lastAttemptAt: now,
        deliveredAt: now,
        lastError: undefined,
      });
      return null;
    }

    if (outcome === "permanent" || attempts >= MAX_ATTEMPTS) {
      await ctx.db.patch("outbox", outboxId, { status: "dead", attempts, lastAttemptAt: now, lastError: error });
      // Shows up in Convex logs / log streams (Datadog, Axiom) as well as the admin page.
      console.error(`[outbox] event ${event.eventId} (${event.type}) is dead after ${attempts} attempt(s): ${error}`);
      return null;
    }

    const base = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];
    const delay = Math.round(base * (0.8 + Math.random() * 0.4)); // ±20% jitter
    await ctx.db.patch("outbox", outboxId, { status: "retrying", attempts, lastAttemptAt: now, lastError: error });
    await ctx.scheduler.runAfter(delay, internal.automation.delivery.deliver, { outboxId });
    console.warn(`[outbox] event ${event.eventId} attempt ${attempts} failed (${error}); retrying in ${delay}ms`);
    return null;
  },
});
