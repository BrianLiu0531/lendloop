import { v } from "convex/values";
import { internal } from "./_generated/api";
import { audit } from "./lib/audit";
import { isIsoDate } from "./lib/dates";
import { conflict, invalid, notFound } from "./lib/errors";
import { adminMutation, adminQuery } from "./lib/functions";
import { loanPhase } from "./lib/loanView";
import { publicName } from "./lib/privacy";
import { vLoanStatus, vRole } from "./lib/validators";
import { OVERDUE_WORKFLOW } from "./automation/inbound";

/** A daily job that hasn't reported in this long is considered stalled. */
export const SWEEP_STALE_AFTER_MS = 26 * 60 * 60 * 1000;

// ─────────────────────────────── reads ───────────────────────────────

export const listings = adminQuery({
  args: { includeRemoved: v.boolean() },
  handler: async (ctx, { includeRemoved }) => {
    const tools = includeRemoved
      ? await ctx.db.query("tools").order("desc").take(300)
      : await ctx.db
          .query("tools")
          .withIndex("by_removedAt", (q) => q.eq("removedAt", undefined))
          .order("desc")
          .take(300);
    return await Promise.all(
      tools.map(async (t) => {
        const owner = await ctx.db.get("users", t.ownerId);
        return {
          _id: t._id,
          name: t.name,
          category: t.category,
          condition: t.condition,
          description: t.description,
          createdAt: t._creationTime,
          removedAt: t.removedAt ?? null,
          removalReason: t.removalReason ?? null,
          owner: { _id: t.ownerId, name: owner?.name ?? "Unknown", trustedLender: owner?.trustedLender ?? false },
        };
      }),
    );
  },
});

export const loans = adminQuery({
  args: { today: v.string(), status: v.optional(vLoanStatus) },
  handler: async (ctx, { today, status }) => {
    if (!isIsoDate(today)) throw invalid("Invalid date.");
    const rows = status
      ? await ctx.db
          .query("loans")
          .withIndex("by_status_and_endDate", (q) => q.eq("status", status))
          .order("desc")
          .take(300)
      : await ctx.db.query("loans").order("desc").take(300);
    return await Promise.all(
      rows.map(async (l) => {
        const [tool, borrower, lender, events] = await Promise.all([
          ctx.db.get("tools", l.toolId),
          ctx.db.get("users", l.borrowerId),
          ctx.db.get("users", l.lenderId),
          ctx.db.query("outbox").withIndex("by_loanId", (q) => q.eq("loanId", l._id)).take(20),
        ]);
        return {
          _id: l._id,
          toolName: tool?.name ?? "Removed tool",
          borrower: borrower?.name ?? "Unknown",
          lender: lender?.name ?? "Unknown",
          startDate: l.startDate,
          endDate: l.endDate,
          status: l.status,
          phase: loanPhase(l, today),
          createdAt: l._creationTime,
          deadEvents: events.filter((e) => e.status === "dead").length,
        };
      }),
    );
  },
});

export const members = adminQuery({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").order("desc").take(500);
    return await Promise.all(
      users.map(async (u) => {
        const tools = await ctx.db
          .query("tools")
          .withIndex("by_ownerId", (q) => q.eq("ownerId", u._id))
          .take(100);
        const lent = await ctx.db
          .query("loans")
          .withIndex("by_lenderId", (q) => q.eq("lenderId", u._id))
          .take(200);
        return {
          _id: u._id,
          name: u.name,
          email: u.email ?? null,
          imageUrl: u.imageUrl ?? null,
          role: u.role,
          trustedLender: u.trustedLender,
          joinedAt: u._creationTime,
          activeListings: tools.filter((t) => t.removedAt === undefined).length,
          completedLoans: lent.filter((l) => l.status === "returned").length,
          isMe: u._id === ctx.viewer._id,
        };
      }),
    );
  },
});

/** Everything an operator needs to see that automation is healthy. */
export const automation = adminQuery({
  args: { now: v.number() },
  handler: async (ctx, { now }) => {
    const [recentEvents, dead, retrying, recentReminders, failures, lastRun] = await Promise.all([
      ctx.db.query("outbox").order("desc").take(30),
      ctx.db.query("outbox").withIndex("by_status", (q) => q.eq("status", "dead")).order("desc").take(50),
      ctx.db.query("outbox").withIndex("by_status", (q) => q.eq("status", "retrying")).take(50),
      ctx.db.query("reminders").order("desc").take(20),
      ctx.db
        .query("automationFailures")
        .withIndex("by_acknowledgedAt", (q) => q.eq("acknowledgedAt", undefined))
        .order("desc")
        .take(50),
      ctx.db
        .query("automationRuns")
        .withIndex("by_workflow", (q) => q.eq("workflow", OVERDUE_WORKFLOW))
        .order("desc")
        .first(),
    ]);

    const describe = async (e: (typeof recentEvents)[number]) => {
      const loan = await ctx.db.get("loans", e.loanId);
      const tool = loan ? await ctx.db.get("tools", loan.toolId) : null;
      const recipient = await ctx.db.get("users", e.recipientId);
      return {
        _id: e._id,
        eventId: e.eventId,
        type: e.type,
        status: e.status,
        attempts: e.attempts,
        lastError: e.lastError ?? null,
        createdAt: e._creationTime,
        lastAttemptAt: e.lastAttemptAt ?? null,
        deliveredAt: e.deliveredAt ?? null,
        toolName: tool?.name ?? "—",
        recipient: `${publicName(recipient)} (${e.recipientRole})`,
      };
    };

    return {
      sweep: lastRun
        ? {
            finishedAt: lastRun.finishedAt,
            asOf: lastRun.asOf,
            overdueCount: lastRun.overdueCount,
            sent: lastRun.sent,
            failed: lastRun.failed,
            stale: now - lastRun.finishedAt > SWEEP_STALE_AFTER_MS,
          }
        : null,
      counts: { dead: dead.length, retrying: retrying.length, openFailures: failures.length },
      recentEvents: await Promise.all(recentEvents.map(describe)),
      deadEvents: await Promise.all(dead.map(describe)),
      recentReminders: await Promise.all(
        recentReminders.map(async (r) => {
          const loan = await ctx.db.get("loans", r.loanId);
          const tool = loan ? await ctx.db.get("tools", loan.toolId) : null;
          return {
            _id: r._id,
            toolName: tool?.name ?? "—",
            asOf: r.asOf,
            status: r.status,
            attempts: r.attempts,
            channel: r.channel,
            error: r.error ?? null,
            updatedAt: r.updatedAt,
          };
        }),
      ),
      failures: failures.map((f) => ({
        _id: f._id,
        workflow: f.workflow,
        node: f.node ?? null,
        message: f.message,
        executionUrl: f.executionUrl ?? null,
        occurredAt: f.occurredAt,
      })),
    };
  },
});

export const auditLog = adminQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("auditLog").order("desc").take(50);
    return rows.map((r) => ({
      _id: r._id,
      at: r._creationTime,
      actor: r.actor,
      action: r.action,
      targetType: r.targetType,
      detail: r.detail ?? null,
    }));
  },
});

// ────────────────────────────── writes ───────────────────────────────

export const setTrustedLender = adminMutation({
  args: { userId: v.id("users"), trusted: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { userId, trusted }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw notFound("Member");
    if (user.trustedLender === trusted) return null;
    await ctx.db.patch("users", userId, { trustedLender: trusted });
    await audit(ctx, ctx.viewer, trusted ? "user.trusted" : "user.untrusted", { type: "users", id: userId }, user.name);
    return null;
  },
});

export const setRole = adminMutation({
  args: { userId: v.id("users"), role: vRole },
  returns: v.null(),
  handler: async (ctx, { userId, role }) => {
    // Prevents locking the last admin out (and accidental self-demotion).
    if (userId === ctx.viewer._id) throw conflict("You can't change your own role.");
    const user = await ctx.db.get("users", userId);
    if (!user) throw notFound("Member");
    if (user.role === role) return null;
    await ctx.db.patch("users", userId, { role });
    await audit(ctx, ctx.viewer, "user.role_changed", { type: "users", id: userId }, `${user.name}: ${user.role} → ${role}`);
    return null;
  },
});

/** Re-drive a dead outbox event after the underlying problem is fixed. */
export const retryEvent = adminMutation({
  args: { outboxId: v.id("outbox") },
  returns: v.null(),
  handler: async (ctx, { outboxId }) => {
    const event = await ctx.db.get("outbox", outboxId);
    if (!event) throw notFound("Event");
    if (event.status !== "dead") throw conflict("Only failed events can be retried.");
    // Same eventId on purpose: if the first attempt actually reached n8n, it dedupes.
    await ctx.db.patch("outbox", outboxId, { status: "queued", attempts: 0, lastError: undefined });
    await ctx.scheduler.runAfter(0, internal.automation.delivery.deliver, { outboxId });
    await audit(ctx, ctx.viewer, "outbox.retried", { type: "outbox", id: outboxId }, event.type);
    return null;
  },
});

export const acknowledgeFailure = adminMutation({
  args: { failureId: v.id("automationFailures") },
  returns: v.null(),
  handler: async (ctx, { failureId }) => {
    const failure = await ctx.db.get("automationFailures", failureId);
    if (!failure) throw notFound("Failure");
    if (failure.acknowledgedAt) return null;
    await ctx.db.patch("automationFailures", failureId, { acknowledgedAt: Date.now(), acknowledgedBy: ctx.viewer._id });
    await audit(ctx, ctx.viewer, "automation.failure_acknowledged", { type: "automationFailures", id: failureId }, failure.workflow);
    return null;
  },
});
