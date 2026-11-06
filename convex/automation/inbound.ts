/**
 * Internal functions behind the signed n8n -> Convex HTTP API (see http.ts).
 * Every write here is idempotent: n8n retries and manual re-runs converge on
 * the same rows instead of creating duplicates.
 */
import { v } from "convex/values";
import { internalMutation, internalQuery } from "../_generated/server";
import { env } from "../_generated/server";
import { audit } from "../lib/audit";
import { daysBetween } from "../lib/dates";
import { publicName } from "../lib/privacy";

export const OVERDUE_WORKFLOW = "overdue-reminders";
const MAX_BATCH = 200;

export const reminderKey = (loanId: string, asOf: string) => `${loanId}:${asOf}`;

/**
 * Loans that are approved (not yet returned) with an end date before
 * `asOf`, minus those already reminded for `asOf`. Payload is minimal:
 * what's needed to write the reminder and nothing else.
 */
export const overdueLoans = internalQuery({
  args: { asOf: v.string() },
  handler: async (ctx, { asOf }) => {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_status_and_endDate", (q) => q.eq("status", "approved").lt("endDate", asOf))
      .take(MAX_BATCH);
    const appUrl = (env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

    const results = [];
    for (const loan of loans) {
      const key = reminderKey(loan._id, asOf);
      const existing = await ctx.db
        .query("reminders")
        .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", key))
        .unique();
      if (existing?.status === "sent") continue;
      const [borrower, lender, tool] = await Promise.all([
        ctx.db.get("users", loan.borrowerId),
        ctx.db.get("users", loan.lenderId),
        ctx.db.get("tools", loan.toolId),
      ]);
      if (!borrower?.email) continue;
      results.push({
        loanId: loan._id,
        idempotencyKey: key,
        borrower: { name: publicName(borrower), email: borrower.email },
        lender: { name: publicName(lender) },
        tool: { name: tool?.name ?? "a borrowed tool" },
        endDate: loan.endDate,
        daysOverdue: daysBetween(loan.endDate, asOf),
        url: `${appUrl}/me/requests?loan=${loan._id}`,
      });
    }
    return { asOf, count: results.length, truncated: loans.length === MAX_BATCH, loans: results };
  },
});

export const recordReminder = internalMutation({
  args: {
    loanId: v.string(),
    asOf: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.string(),
    executionId: v.string(),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const loanId = ctx.db.normalizeId("loans", args.loanId);
    if (!loanId || !(await ctx.db.get("loans", loanId))) {
      return { ok: false as const, status: 404, error: "Unknown loan" };
    }
    const idempotencyKey = reminderKey(loanId, args.asOf);
    const existing = await ctx.db
      .query("reminders")
      .withIndex("by_idempotencyKey", (q) => q.eq("idempotencyKey", idempotencyKey))
      .unique();
    const now = Date.now();
    const error = args.error?.slice(0, 500);

    if (!existing) {
      await ctx.db.insert("reminders", {
        idempotencyKey,
        loanId,
        asOf: args.asOf,
        status: args.status,
        channel: args.channel.slice(0, 40),
        executionId: args.executionId.slice(0, 100),
        error,
        attempts: 1,
        updatedAt: now,
      });
      return { ok: true as const, result: "created" as const, idempotencyKey };
    }
    // "sent" is terminal: a late "failed" from a stale retry must not downgrade it,
    // and a duplicate "sent" changes nothing.
    if (existing.status === "sent") {
      return { ok: true as const, result: "duplicate" as const, idempotencyKey };
    }
    await ctx.db.patch("reminders", existing._id, {
      status: args.status,
      executionId: args.executionId.slice(0, 100),
      error: args.status === "sent" ? undefined : error,
      attempts: existing.attempts + 1,
      updatedAt: now,
    });
    return { ok: true as const, result: "updated" as const, idempotencyKey };
  },
});

export const recordRun = internalMutation({
  args: {
    executionId: v.string(),
    workflow: v.string(),
    asOf: v.string(),
    overdueCount: v.number(),
    sent: v.number(),
    failed: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("automationRuns")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .unique();
    const fields = { ...args, finishedAt: Date.now() };
    if (existing) {
      await ctx.db.patch("automationRuns", existing._id, fields);
      return { result: "updated" as const };
    }
    await ctx.db.insert("automationRuns", fields);
    return { result: "created" as const };
  },
});

export const recordFailure = internalMutation({
  args: {
    executionId: v.string(),
    workflow: v.string(),
    node: v.optional(v.string()),
    message: v.string(),
    executionUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("automationFailures")
      .withIndex("by_executionId", (q) => q.eq("executionId", args.executionId))
      .unique();
    if (existing) return { result: "duplicate" as const };
    const id = await ctx.db.insert("automationFailures", {
      executionId: args.executionId.slice(0, 100),
      workflow: args.workflow.slice(0, 100),
      node: args.node?.slice(0, 100),
      message: args.message.slice(0, 1000),
      executionUrl: args.executionUrl?.slice(0, 500),
      occurredAt: Date.now(),
    });
    await audit(ctx, "n8n", "automation.failed", { type: "automationFailures", id }, args.workflow);
    console.error(`[n8n] workflow "${args.workflow}" failed at ${args.node ?? "?"}: ${args.message}`);
    return { result: "created" as const };
  },
});
