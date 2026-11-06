"use client";

import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { AlertTriangle, BellRing, Check, ChevronDown, Mail, MessageSquareQuote, PackageCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { CategoryIcon } from "@/components/category-icon";
import { LoanStatusBadge } from "@/components/loan-status";
import { LoanTimeline } from "@/components/loan-timeline";
import { TrustedMark } from "@/components/trusted-badge";
import { Button, Card } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { ago, dateRange, daysUntil, nights } from "@/lib/format";

export type LoanRow = FunctionReturnType<typeof api.loans.myRequests>[number];
type Perspective = "borrower" | "lender";

const OPEN_PHASES = new Set(["pending", "scheduled", "active", "overdue"]);

export function splitLoans(loans: LoanRow[]) {
  return {
    open: loans.filter((l) => OPEN_PHASES.has(l.phase)),
    past: loans.filter((l) => !OPEN_PHASES.has(l.phase)),
  };
}

/** One human sentence about what automation last did for this loan. */
function automationLine(loan: LoanRow, perspective: Perspective): { icon: ReactNode; text: string; danger?: boolean } | null {
  const a = loan.automation;
  if (a.hasFailures && perspective === "lender") {
    return { icon: <AlertTriangle className="size-3.5" />, text: "A notification failed — admins have been alerted", danger: true };
  }
  if (a.lastReminderAt) {
    const count = a.reminderCount > 1 ? ` (${a.reminderCount} so far)` : "";
    return { icon: <BellRing className="size-3.5" />, text: `Reminder sent ${ago(a.lastReminderAt)}${count}` };
  }
  const n = a.lastNotification;
  if (!n) return null;
  const who = n.recipientRole === perspective ? "You were" : perspective === "borrower" ? "Owner" : "Borrower";
  if (n.status === "delivered") return { icon: <Mail className="size-3.5" />, text: `${who} notified ${ago(n.at)}` };
  if (n.status === "dead") return { icon: <AlertTriangle className="size-3.5" />, text: "Notification failed — admins alerted", danger: true };
  return { icon: <Mail className="size-3.5" />, text: "Sending notification…" };
}

function dueLine(loan: LoanRow, today: string) {
  if (loan.phase === "overdue") {
    const d = -daysUntil(loan.endDate, today);
    return `${d} day${d === 1 ? "" : "s"} overdue`;
  }
  if (loan.phase === "active") {
    const d = daysUntil(loan.endDate, today);
    return d === 0 ? "Due back today" : `Due back in ${d} day${d === 1 ? "" : "s"}`;
  }
  if (loan.phase === "scheduled") {
    const d = daysUntil(loan.startDate, today);
    return d === 0 ? "Pick-up today" : `Starts in ${d} day${d === 1 ? "" : "s"}`;
  }
  return null;
}

function LoanActions({ loan, perspective }: { loan: LoanRow; perspective: Perspective }) {
  const approve = useMutation(api.loans.approve);
  const decline = useMutation(api.loans.decline);
  const cancel = useMutation(api.loans.cancel);
  const markReturned = useMutation(api.loans.markReturned);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(name: string, fn: () => Promise<unknown>, success: string) {
    setBusy(name);
    try {
      await fn();
      toast.success(success);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }
  const args = { loanId: loan._id };

  if (perspective === "lender") {
    if (loan.phase === "pending") {
      return (
        <>
          <Button size="sm" variant="secondary" loading={busy === "decline"} disabled={!!busy} onClick={() => run("decline", () => decline(args), "Request declined")}>
            <X className="size-4" aria-hidden /> Decline
          </Button>
          <Button size="sm" loading={busy === "approve"} disabled={!!busy} onClick={() => run("approve", () => approve(args), `Approved — ${loan.counterpart.name} has been notified`)}>
            <Check className="size-4" aria-hidden /> Approve
          </Button>
        </>
      );
    }
    if (loan.phase === "active" || loan.phase === "overdue" || loan.phase === "scheduled") {
      return (
        <Button size="sm" variant={loan.phase === "overdue" ? "primary" : "secondary"} loading={busy === "return"} onClick={() => run("return", () => markReturned(args), "Marked as returned")}>
          <PackageCheck className="size-4" aria-hidden /> Mark returned
        </Button>
      );
    }
    return null;
  }
  if (loan.phase === "pending" || loan.phase === "scheduled") {
    return (
      <Button size="sm" variant="ghost" loading={busy === "cancel"} onClick={() => run("cancel", () => cancel(args), "Request cancelled")}>
        Cancel request
      </Button>
    );
  }
  return null;
}

export function LoanCard({
  loan,
  perspective,
  today,
  highlighted,
}: {
  loan: LoanRow;
  perspective: Perspective;
  today: string;
  highlighted?: boolean;
}) {
  const [expanded, setExpanded] = useState(!!highlighted);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted]);

  const automation = automationLine(loan, perspective);
  const due = dueLine(loan, today);

  return (
    <Card
      ref={ref}
      className={cn(
        "overflow-hidden transition-shadow",
        highlighted && "ring-2 ring-brand/40",
        loan.phase === "overdue" && "border-danger/30",
      )}
    >
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <CategoryIcon category={loan.toolCategory} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tools/${loan.toolId}`} className="font-display text-lg text-ink hover:text-brand-strong">
              {loan.toolName}
            </Link>
            <LoanStatusBadge phase={loan.phase} />
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
            <span>
              {perspective === "borrower" ? "from" : "for"} {loan.counterpart.name}
            </span>
            {loan.counterpart.trustedLender && perspective === "borrower" && <TrustedMark />}
            <span className="text-ink-faint">·</span>
            <span>
              {dateRange(loan.startDate, loan.endDate)} <span className="text-ink-faint">({nights(loan.startDate, loan.endDate)})</span>
            </span>
            {due && (
              <>
                <span className="text-ink-faint">·</span>
                <span className={loan.phase === "overdue" ? "font-medium text-danger" : ""}>{due}</span>
              </>
            )}
          </p>
          {loan.counterpart.email && (
            <p className="mt-2 text-sm text-ink-soft">
              Contact {loan.counterpart.name} to arrange {perspective === "borrower" ? "pick-up" : "hand-over"}:{" "}
              <a href={`mailto:${loan.counterpart.email}`} className="font-medium text-brand-strong hover:underline">
                {loan.counterpart.email}
              </a>
            </p>
          )}
          {loan.message && perspective === "lender" && (
            <p className="mt-3 flex gap-2 rounded-xl bg-sunken px-3.5 py-2.5 text-sm text-ink-soft">
              <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-ink-faint" aria-hidden />
              <span className="whitespace-pre-line">{loan.message}</span>
            </p>
          )}
          {loan.closedReason && (loan.phase === "declined" || loan.phase === "cancelled") && (
            <p className="mt-2 text-sm text-ink-faint">{loan.closedReason}</p>
          )}
          <button
            type="button"
            onClick={() => setExpanded((x) => !x)}
            className={cn(
              "mt-3 inline-flex cursor-pointer items-center gap-1.5 text-xs",
              automation?.danger ? "text-danger" : "text-ink-faint hover:text-ink-soft",
            )}
            aria-expanded={expanded}
          >
            {automation ? automation.icon : null}
            {automation ? automation.text : "Activity"}
            <ChevronDown className={cn("size-3.5 transition-transform", expanded && "rotate-180")} aria-hidden />
          </button>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <LoanActions loan={loan} perspective={perspective} />
        </div>
      </div>
      {expanded && (
        <div className="border-t border-line bg-paper/60 px-5 py-4">
          <LoanTimeline loanId={loan._id as Id<"loans">} />
        </div>
      )}
    </Card>
  );
}
