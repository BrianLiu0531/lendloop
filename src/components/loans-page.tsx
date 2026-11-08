"use client";

import { useQuery } from "convex/react";
import { History, Inbox, Send } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { LoanCard, splitLoans } from "@/components/loan-list";
import { ButtonLink, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToday } from "@/hooks/use-today";
import { cn } from "@/lib/cn";

const COPY = {
  borrower: {
    title: "My requests",
    description: "Things you've asked to borrow, and where each request stands.",
    emptyTitle: "No requests yet",
    emptyBody: "Find something on the board and ask for the dates you need.",
    icon: <Send className="size-5" />,
  },
  lender: {
    title: "Incoming requests",
    description: "Neighbors asking to borrow your tools. Approve, decline, and confirm returns here.",
    emptyTitle: "Nothing incoming",
    emptyBody: "When someone asks to borrow one of your tools, it shows up here.",
    icon: <Inbox className="size-5" />,
  },
} as const;

export function LoansPage({ perspective }: { perspective: "borrower" | "lender" }) {
  const today = useToday();
  const params = useSearchParams();
  const focus = params.get("loan");
  const query = perspective === "borrower" ? api.loans.myRequests : api.loans.incoming;
  const loans = useQuery(query, today ? { today } : "skip");
  const [tab, setTab] = useState<"open" | "past">("open");
  const copy = COPY[perspective];

  if (loans === undefined || !today) {
    return (
      <>
        <PageHeader title={copy.title} description={copy.description} />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </>
    );
  }

  const { open, past } = splitLoans(loans);
  // A deep link (?loan=…) to a closed loan should land on the History tab.
  const effectiveTab = focus && past.some((l) => l._id === focus) && !open.some((l) => l._id === focus) ? "past" : tab;
  const shown = effectiveTab === "open" ? open : past;
  const needsAction =
    perspective === "lender"
      ? open.filter((l) => l.phase === "pending" || l.phase === "overdue").length
      : open.filter((l) => l.phase === "overdue").length;

  return (
    <>
      <PageHeader title={copy.title} description={copy.description} />

      {loans.length === 0 ? (
        <EmptyState
          icon={copy.icon}
          title={copy.emptyTitle}
          action={perspective === "borrower" ? <ButtonLink href="/board">Browse the board</ButtonLink> : undefined}
        >
          {copy.emptyBody}
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 inline-flex rounded-lg border border-line bg-surface p-1" role="tablist">
            <TabButton active={effectiveTab === "open"} onClick={() => setTab("open")}>
              Open
              <span className="ml-1.5 tabular-nums text-ink-faint">{open.length}</span>
              {needsAction > 0 && <span className="ml-1.5 size-1.5 rounded-full bg-brand" aria-label="needs attention" />}
            </TabButton>
            <TabButton active={effectiveTab === "past"} onClick={() => setTab("past")}>
              History
              <span className="ml-1.5 tabular-nums text-ink-faint">{past.length}</span>
            </TabButton>
          </div>

          {shown.length === 0 ? (
            <EmptyState icon={<History className="size-5" />} title={effectiveTab === "open" ? "All caught up" : "No history yet"}>
              {effectiveTab === "open" ? "Nothing needs your attention right now." : "Finished loans will appear here."}
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {shown.map((loan, i) => (
                <li key={loan._id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 10) * 25}ms` }}>
                  <LoanCard loan={loan} perspective={perspective} today={today} highlighted={loan._id === focus} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-ink text-paper [&_span]:text-paper/70" : "text-ink-soft hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
