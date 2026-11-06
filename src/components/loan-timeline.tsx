"use client";

import { useQuery } from "convex/react";
import { BellRing, CircleDot, Mail } from "lucide-react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { ago } from "@/lib/format";

const TONE = {
  neutral: "bg-sunken text-ink-faint",
  success: "bg-brand-soft text-brand",
  warning: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
} as const;

const ICON = { status: CircleDot, notification: Mail, reminder: BellRing } as const;

/** Status changes interleaved with what the automation did, newest first. */
export function LoanTimeline({ loanId }: { loanId: Id<"loans"> }) {
  const entries = useQuery(api.loans.timeline, { loanId });
  if (!entries) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-5 w-1/2" />
      </div>
    );
  }
  return (
    <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[0.81rem] before:top-2 before:w-px before:bg-line">
      {entries.map((e, i) => {
        const Icon = ICON[e.kind];
        return (
          <li key={i} className="relative flex items-start gap-3">
            <span className={cn("z-10 flex size-[1.65rem] shrink-0 items-center justify-center rounded-full", TONE[e.tone])}>
              <Icon className="size-3.5" aria-hidden />
            </span>
            <div className="pt-0.5 text-sm">
              <span className={e.tone === "danger" ? "text-danger" : "text-ink"}>{e.label}</span>
              <span className="ml-2 text-ink-faint" title={new Date(e.at).toLocaleString()}>
                {ago(e.at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
