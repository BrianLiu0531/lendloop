import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { LoanEventType, RecipientRole } from "./validators";

/** Who needs to hear about each event. */
const RECIPIENT: Record<LoanEventType, RecipientRole> = {
  "loan.requested": "lender",
  "loan.cancelled": "lender",
  "loan.approved": "borrower",
  "loan.declined": "borrower",
  "loan.returned": "borrower",
};

/**
 * Records a loan event in the outbox inside the caller's transaction and
 * schedules delivery. If the mutation rolls back, so does the event — and
 * if it commits, the event is guaranteed to be attempted (no dual-write gap
 * between "saved the loan" and "called the webhook").
 */
export async function publishLoanEvent(
  ctx: MutationCtx,
  type: LoanEventType,
  loan: Doc<"loans">,
  recipientRole: RecipientRole = RECIPIENT[type],
) {
  const eventId = crypto.randomUUID();
  const outboxId = await ctx.db.insert("outbox", {
    eventId,
    type,
    loanId: loan._id,
    recipientId: recipientRole === "lender" ? loan.lenderId : loan.borrowerId,
    recipientRole,
    status: "queued",
    attempts: 0,
  });
  await ctx.scheduler.runAfter(0, internal.automation.delivery.deliver, { outboxId });
  return eventId;
}
