/**
 * Authorization policy, in one place, as pure functions over documents.
 *
 * Keeping these free of `ctx` makes the whole access-control matrix easy to
 * read in review and to unit test exhaustively (see policy.test.ts).
 *
 *                       owner/lender   borrower   other user   admin
 *   edit/delete tool         ✔             –           ✘          ✘ (remove only)
 *   remove any listing       ✔ (own)       –           ✘          ✔
 *   request to borrow        ✘             ✔           ✔          ✔
 *   approve/decline          ✔             ✘           ✘          ✘
 *   cancel request           ✘             ✔           ✘          ✘
 *   mark returned            ✔             ✘           ✘          ✔
 *   view a loan              ✔             ✔           ✘          ✔
 *
 * Admins deliberately can't approve loans on behalf of lenders: moderation
 * powers shouldn't let them commit someone else's property.
 */
import type { Doc } from "../_generated/dataModel";
import type { Viewer } from "./auth";
import { conflict, forbidden } from "./errors";

type Tool = Doc<"tools">;
type Loan = Doc<"loans">;

export type Decision = { ok: true } | { ok: false; reason: string };
const allow: Decision = { ok: true };
const deny = (reason: string): Decision => ({ ok: false, reason });

export function enforce(decision: Decision, kind: "forbidden" | "conflict" = "forbidden") {
  if (!decision.ok) throw kind === "forbidden" ? forbidden(decision.reason) : conflict(decision.reason);
}

const isOwner = (viewer: Viewer, tool: Tool) => tool.ownerId === viewer._id;

export function canEditTool(viewer: Viewer, tool: Tool): Decision {
  if (tool.removedAt !== undefined) return deny("This listing has been removed.");
  return isOwner(viewer, tool) ? allow : deny("You can only edit your own listings.");
}

export function canRemoveTool(viewer: Viewer, tool: Tool): Decision {
  if (tool.removedAt !== undefined) return deny("This listing has already been removed.");
  return isOwner(viewer, tool) || viewer.role === "admin"
    ? allow
    : deny("You can only delete your own listings.");
}

export function canRequestTool(viewer: Viewer, tool: Tool): Decision {
  if (tool.removedAt !== undefined) return deny("This listing is no longer available.");
  return isOwner(viewer, tool) ? deny("You can't borrow your own tool.") : allow;
}

export function canViewLoan(viewer: Viewer, loan: Loan): Decision {
  return loan.lenderId === viewer._id || loan.borrowerId === viewer._id || viewer.role === "admin"
    ? allow
    : deny("You can only view loans you're part of.");
}

export function canDecideLoan(viewer: Viewer, loan: Loan): Decision {
  if (loan.lenderId !== viewer._id) return deny("Only the tool's owner can respond to this request.");
  if (loan.status !== "pending") return deny(`This request is already ${loan.status}.`);
  return allow;
}

export function canCancelLoan(viewer: Viewer, loan: Loan, today: string): Decision {
  if (loan.borrowerId !== viewer._id) return deny("Only the borrower can cancel this request.");
  if (loan.status === "pending") return allow;
  if (loan.status === "approved" && today < loan.startDate) return allow;
  return deny(
    loan.status === "approved"
      ? "This loan has already started — ask the owner to mark it returned."
      : `This request is already ${loan.status}.`,
  );
}

export function canMarkReturned(viewer: Viewer, loan: Loan): Decision {
  if (loan.lenderId !== viewer._id && viewer.role !== "admin") {
    return deny("Only the tool's owner can mark it as returned.");
  }
  if (loan.status !== "approved") return deny(`Only an active loan can be returned (this one is ${loan.status}).`);
  return allow;
}
