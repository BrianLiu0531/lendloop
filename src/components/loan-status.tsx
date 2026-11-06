import { Badge } from "@/components/ui/primitives";

export type LoanPhase = "pending" | "scheduled" | "active" | "overdue" | "returned" | "declined" | "cancelled";

const PHASE: Record<LoanPhase, { label: string; tone: Parameters<typeof Badge>[0]["tone"] }> = {
  pending: { label: "Waiting for reply", tone: "info" },
  scheduled: { label: "Approved", tone: "brand" },
  active: { label: "On loan", tone: "warn" },
  overdue: { label: "Overdue", tone: "danger" },
  returned: { label: "Returned", tone: "neutral" },
  declined: { label: "Declined", tone: "neutral" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export function LoanStatusBadge({ phase }: { phase: LoanPhase }) {
  return <Badge tone={PHASE[phase].tone}>{PHASE[phase].label}</Badge>;
}

/** Status of a loan from its raw status (no dates), used where phase isn't computed. */
export function rawStatusPhase(status: "pending" | "approved" | "declined" | "cancelled" | "returned"): LoanPhase {
  return status === "approved" ? "scheduled" : status;
}
