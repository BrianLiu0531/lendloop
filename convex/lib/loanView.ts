import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";

export type LoanPhase =
  | "pending"
  | "scheduled"
  | "active"
  | "overdue"
  | "returned"
  | "declined"
  | "cancelled";

export function loanPhase(loan: Doc<"loans">, today: string): LoanPhase {
  if (loan.status !== "approved") return loan.status;
  if (today < loan.startDate) return "scheduled";
  if (today > loan.endDate) return "overdue";
  return "active";
}

/** Compact automation summary used by list rows ("Reminder sent 2 days ago"). */
export async function automationSummary(ctx: QueryCtx, loanId: Id<"loans">) {
  const [events, reminders] = await Promise.all([
    ctx.db.query("outbox").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).order("desc").take(20),
    ctx.db.query("reminders").withIndex("by_loanId", (q) => q.eq("loanId", loanId)).order("desc").take(20),
  ]);
  const lastEvent = events[0];
  const sentReminders = reminders.filter((r) => r.status === "sent");
  return {
    lastNotification: lastEvent
      ? {
          type: lastEvent.type,
          recipientRole: lastEvent.recipientRole,
          status: lastEvent.status,
          at: lastEvent.deliveredAt ?? lastEvent.lastAttemptAt ?? lastEvent._creationTime,
        }
      : null,
    lastReminderAt: sentReminders[0]?.updatedAt ?? null,
    reminderCount: sentReminders.length,
    hasFailures: events.some((e) => e.status === "dead") || reminders.some((r) => r.status === "failed"),
  };
}

export type TimelineEntry = {
  at: number;
  kind: "status" | "notification" | "reminder";
  label: string;
  tone: "neutral" | "success" | "warning" | "danger";
};

const EVENT_LABEL: Record<Doc<"outbox">["type"], string> = {
  "loan.requested": "new request",
  "loan.approved": "approval",
  "loan.declined": "decline",
  "loan.cancelled": "cancellation",
  "loan.returned": "return confirmation",
};

/** Full history of a loan: state changes interleaved with automation activity. */
export async function loanTimeline(ctx: QueryCtx, loan: Doc<"loans">): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [{ at: loan._creationTime, kind: "status", label: "Request sent", tone: "neutral" }];
  if (loan.decidedAt) {
    const label =
      loan.status === "declined"
        ? loan.closedReason ?? "Request declined"
        : loan.status === "cancelled"
          ? loan.closedReason ?? "Request cancelled"
          : "Request approved";
    const tone = loan.status === "declined" || loan.status === "cancelled" ? "warning" : "success";
    entries.push({ at: loan.decidedAt, kind: "status", label, tone });
  }
  if (loan.returnedAt) entries.push({ at: loan.returnedAt, kind: "status", label: "Marked as returned", tone: "success" });

  const events = await ctx.db.query("outbox").withIndex("by_loanId", (q) => q.eq("loanId", loan._id)).take(50);
  for (const e of events) {
    const who = e.recipientRole === "lender" ? "Owner" : "Borrower";
    const what = EVENT_LABEL[e.type];
    if (e.status === "delivered") {
      entries.push({ at: e.deliveredAt!, kind: "notification", label: `${who} notified of ${what}`, tone: "neutral" });
    } else if (e.status === "dead") {
      entries.push({ at: e.lastAttemptAt ?? e._creationTime, kind: "notification", label: `Couldn't notify ${who.toLowerCase()} of ${what} (admins alerted)`, tone: "danger" });
    } else {
      entries.push({ at: e.lastAttemptAt ?? e._creationTime, kind: "notification", label: `Notifying ${who.toLowerCase()} of ${what}…`, tone: "neutral" });
    }
  }

  const reminders = await ctx.db.query("reminders").withIndex("by_loanId", (q) => q.eq("loanId", loan._id)).take(50);
  for (const r of reminders) {
    entries.push(
      r.status === "sent"
        ? { at: r.updatedAt, kind: "reminder", label: "Overdue reminder sent to borrower", tone: "warning" }
        : { at: r.updatedAt, kind: "reminder", label: "Overdue reminder failed (admins alerted)", tone: "danger" },
    );
  }
  return entries.sort((a, b) => b.at - a.at);
}
