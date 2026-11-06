import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { assertValidLoanRange, isIsoDate, rangesOverlap, toIsoDate } from "./lib/dates";
import { conflict, invalid, notFound } from "./lib/errors";
import { userMutation, userQuery } from "./lib/functions";
import { automationSummary, loanPhase, loanTimeline } from "./lib/loanView";
import { publishLoanEvent } from "./lib/outbox";
import {
  canCancelLoan,
  canDecideLoan,
  canMarkReturned,
  canRequestTool,
  canViewLoan,
  enforce,
} from "./lib/policy";
import { rateLimiter } from "./lib/rateLimits";
import { LIMITS } from "./lib/validators";
import { publicName } from "./lib/privacy";

// ───────────────────────────── helpers ─────────────────────────────

async function loadLoan(ctx: QueryCtx, loanId: Id<"loans">) {
  const loan = await ctx.db.get("loans", loanId);
  if (!loan) throw notFound("Loan");
  return loan;
}

async function approvedOverlap(ctx: QueryCtx, toolId: Id<"tools">, start: string, end: string, except?: Id<"loans">) {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .take(100);
  return approved.find((l) => l._id !== except && rangesOverlap(start, end, l.startDate, l.endDate)) ?? null;
}

async function toLoanRow(ctx: QueryCtx, loan: Doc<"loans">, today: string, counterpartId: Id<"users">) {
  const [tool, counterpart, automation] = await Promise.all([
    ctx.db.get("tools", loan.toolId),
    ctx.db.get("users", counterpartId),
    automationSummary(ctx, loan._id),
  ]);
  return {
    _id: loan._id,
    toolId: loan.toolId,
    toolName: tool?.name ?? "Removed tool",
    toolCategory: tool?.category ?? "other",
    counterpart: {
      name: publicName(counterpart),
      trustedLender: counterpart?.trustedLender ?? false,
      // Contact details are exchanged only with consent (an approved loan) and only
      // while the loan is open; once returned/declined they're hidden again.
      email: loan.status === "approved" ? (counterpart?.email ?? null) : null,
    },
    startDate: loan.startDate,
    endDate: loan.endDate,
    message: loan.message ?? null,
    status: loan.status,
    phase: loanPhase(loan, today),
    closedReason: loan.closedReason ?? null,
    createdAt: loan._creationTime,
    automation,
  };
}

const actionLimit = (ctx: MutationCtx & { viewer: Doc<"users"> }) =>
  rateLimiter.limit(ctx, "loanAction", { key: ctx.viewer._id, throws: true });

// ───────────────────────────── queries ─────────────────────────────

/** Requests I made as a borrower. */
export const myRequests = userQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!isIsoDate(today)) throw invalid("Invalid date.");
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", ctx.viewer._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => toLoanRow(ctx, l, today, l.lenderId)));
  },
});

/** Requests other people made for my tools. */
export const incoming = userQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    if (!isIsoDate(today)) throw invalid("Invalid date.");
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_lenderId", (q) => q.eq("lenderId", ctx.viewer._id))
      .order("desc")
      .take(100);
    return await Promise.all(loans.map((l) => toLoanRow(ctx, l, today, l.borrowerId)));
  },
});

/** Full timeline (status changes + automation activity) for one loan. */
export const timeline = userQuery({
  args: { loanId: v.id("loans") },
  handler: async (ctx, { loanId }) => {
    const loan = await loadLoan(ctx, loanId);
    enforce(canViewLoan(ctx.viewer, loan));
    return await loanTimeline(ctx, loan);
  },
});

// ──────────────────────────── mutations ────────────────────────────

export const request = userMutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
  },
  returns: v.id("loans"),
  handler: async (ctx, { toolId, startDate, endDate, message }) => {
    await rateLimiter.limit(ctx, "requestLoan", { key: ctx.viewer._id, throws: true });
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw notFound("Tool");
    enforce(canRequestTool(ctx.viewer, tool));
    assertValidLoanRange(startDate, endDate, Date.now());

    const cleanMessage = message?.trim();
    if (cleanMessage && cleanMessage.length > LIMITS.requestMessage.max) {
      throw invalid(`Message must be at most ${LIMITS.requestMessage.max} characters.`);
    }
    if (await approvedOverlap(ctx, toolId, startDate, endDate)) {
      throw conflict("Those dates are already booked. Pick another window.");
    }
    const alreadyPending = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", "pending"))
      .filter((q) => q.eq(q.field("borrowerId"), ctx.viewer._id))
      .first();
    if (alreadyPending) throw conflict("You already have an open request for this tool.");

    const loanId = await ctx.db.insert("loans", {
      toolId,
      lenderId: tool.ownerId,
      borrowerId: ctx.viewer._id,
      startDate,
      endDate,
      message: cleanMessage || undefined,
      status: "pending",
    });
    await publishLoanEvent(ctx, "loan.requested", (await ctx.db.get("loans", loanId))!);
    return loanId;
  },
});

/**
 * Approving re-checks for overlap inside the transaction (Convex mutations
 * are serializable, so two concurrent approvals can't both win), then
 * auto-declines other pending requests that now clash, notifying each.
 */
export const approve = userMutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    await actionLimit(ctx);
    const loan = await loadLoan(ctx, loanId);
    enforce(canDecideLoan(ctx.viewer, loan));
    const tool = await ctx.db.get("tools", loan.toolId);
    if (!tool || tool.removedAt !== undefined) throw conflict("This listing has been removed.");
    if (loan.endDate < toIsoDate(Date.now())) throw conflict("These dates have already passed — decline instead.");
    if (await approvedOverlap(ctx, loan.toolId, loan.startDate, loan.endDate, loan._id)) {
      throw conflict("You've already lent this tool out for overlapping dates.");
    }

    const now = Date.now();
    await ctx.db.patch("loans", loanId, { status: "approved", decidedAt: now });
    await publishLoanEvent(ctx, "loan.approved", { ...loan, status: "approved" });

    const pending = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", loan.toolId).eq("status", "pending"))
      .take(100);
    for (const other of pending) {
      if (other._id === loanId || !rangesOverlap(loan.startDate, loan.endDate, other.startDate, other.endDate)) continue;
      const closedReason = "Those dates were booked by another neighbor";
      await ctx.db.patch("loans", other._id, { status: "declined", decidedAt: now, closedReason });
      await publishLoanEvent(ctx, "loan.declined", { ...other, status: "declined" });
    }
    return null;
  },
});

export const decline = userMutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    await actionLimit(ctx);
    const loan = await loadLoan(ctx, loanId);
    enforce(canDecideLoan(ctx.viewer, loan));
    await ctx.db.patch("loans", loanId, { status: "declined", decidedAt: Date.now() });
    await publishLoanEvent(ctx, "loan.declined", { ...loan, status: "declined" });
    return null;
  },
});

export const cancel = userMutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    await actionLimit(ctx);
    const loan = await loadLoan(ctx, loanId);
    enforce(canCancelLoan(ctx.viewer, loan, toIsoDate(Date.now())));
    await ctx.db.patch("loans", loanId, {
      status: "cancelled",
      decidedAt: Date.now(),
      closedReason: "Cancelled by the borrower",
    });
    await publishLoanEvent(ctx, "loan.cancelled", { ...loan, status: "cancelled" });
    return null;
  },
});

export const markReturned = userMutation({
  args: { loanId: v.id("loans") },
  returns: v.null(),
  handler: async (ctx, { loanId }) => {
    await actionLimit(ctx);
    const loan = await loadLoan(ctx, loanId);
    enforce(canMarkReturned(ctx.viewer, loan));
    await ctx.db.patch("loans", loanId, { status: "returned", returnedAt: Date.now() });
    await publishLoanEvent(ctx, "loan.returned", { ...loan, status: "returned" });
    return null;
  },
});

/** Badge counts for the navigation bar. */
export const navCounts = userQuery({
  args: {},
  handler: async (ctx) => {
    const [incoming, mine] = await Promise.all([
      ctx.db
        .query("loans")
        .withIndex("by_lenderId", (q) => q.eq("lenderId", ctx.viewer._id))
        .order("desc")
        .take(200),
      ctx.db
        .query("loans")
        .withIndex("by_borrowerId", (q) => q.eq("borrowerId", ctx.viewer._id))
        .order("desc")
        .take(200),
    ]);
    return {
      incomingPending: incoming.filter((l) => l.status === "pending").length,
      myPending: mine.filter((l) => l.status === "pending").length,
    };
  },
});
