import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type Availability =
  | { state: "available"; nextBookedFrom: string | null }
  | { state: "on_loan"; until: string; overdue: boolean };

/**
 * Approved loans for a tool, earliest first. "approved" means "not returned
 * yet", so this is exactly the set of current + future bookings.
 */
export async function approvedLoansForTool(ctx: QueryCtx, toolId: Id<"tools">) {
  const approved = await ctx.db
    .query("loans")
    .withIndex("by_toolId_and_status", (q) => q.eq("toolId", toolId).eq("status", "approved"))
    .take(100);
  return approved.sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Availability is derived from approved loans + the caller-supplied date
 * (queries must not read the wall clock, so the client passes "today").
 * An approved loan whose end date has passed but isn't returned yet keeps
 * the tool "on loan" and flags it overdue.
 */
export function computeAvailability(loans: Doc<"loans">[], today: string): Availability {
  const current = loans.find((l) => l.startDate <= today);
  if (current) return { state: "on_loan", until: current.endDate, overdue: current.endDate < today };
  const next = loans.find((l) => l.startDate > today);
  return { state: "available", nextBookedFrom: next?.startDate ?? null };
}
