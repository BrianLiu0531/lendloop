"use client";

import { useQuery } from "convex/react";
import { ArrowLeft, CalendarDays, Pencil, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { AvailabilityBadge } from "@/components/availability-badge";
import { CategoryIcon } from "@/components/category-icon";
import { LoanStatusBadge, rawStatusPhase } from "@/components/loan-status";
import { RequestDialog } from "@/components/request-dialog";
import { TrustedMark } from "@/components/trusted-badge";
import { Badge, Button, ButtonLink, Card, EmptyState, Skeleton } from "@/components/ui/primitives";
import { useToday } from "@/hooks/use-today";
import { CATEGORY, CONDITION } from "@/lib/catalog";
import { dateRange, nights } from "@/lib/format";

export function ToolDetail() {
  const { id } = useParams<{ id: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const today = useToday();
  const tool = useQuery(api.tools.get, today ? { toolId: id, today } : "skip");
  const [requestOpen, setRequestOpen] = useState(params.get("request") === "1");

  if (tool === undefined || !today) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (tool === null) {
    return (
      <EmptyState
        icon={<SearchX className="size-5" />}
        title="This tool isn't on the board"
        action={<ButtonLink href="/board">Back to the board</ButtonLink>}
      >
        It may have been removed by its owner.
      </EmptyState>
    );
  }

  const upcoming = tool.booked.filter((b) => b.endDate >= today);
  const openRequest = tool.myLoans.find((l) => l.status === "pending");

  return (
    <div className="animate-fade-up">
      <Link href="/board" className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Back to the board
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-6 sm:p-8">
          <div className="flex items-start gap-5">
            <CategoryIcon category={tool.category} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <AvailabilityBadge availability={tool.availability} />
                {tool.removed && <Badge tone="danger">Removed</Badge>}
              </div>
              <h1 className="mt-2 font-display text-3xl tracking-tight sm:text-4xl">{tool.name}</h1>
              <p className="mt-1 text-ink-soft">
                {CATEGORY[tool.category].label} · {CONDITION[tool.condition].label}
                <span className="text-ink-faint"> — {CONDITION[tool.condition].hint.toLowerCase()}</span>
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">About this tool</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-soft">
              {tool.description || "The owner didn't add a description."}
            </p>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="flex items-center gap-1.5 text-sm font-medium uppercase tracking-wide text-ink-faint">
              <CalendarDays className="size-4" aria-hidden /> Booked dates
            </h2>
            {upcoming.length === 0 ? (
              <p className="mt-2 text-ink-soft">No bookings yet — any dates are open.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
                {upcoming.map((b) => (
                  <li key={b.startDate} className="rounded-lg bg-sunken px-3 py-1.5 text-sm text-ink-soft">
                    {dateRange(b.startDate, b.endDate)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-6">
            <p className="text-sm text-ink-faint">Lent by</p>
            <p className="mt-1 flex items-center gap-2 font-display text-2xl">
              {tool.isMine ? "You" : tool.owner.name}
              {tool.owner.trustedLender && <TrustedMark />}
            </p>
            {tool.owner.trustedLender && (
              <p className="mt-1 text-sm text-trust">Trusted Lender — verified by a LendLoop admin</p>
            )}
            <div className="mt-6">
              {tool.isMine ? (
                <ButtonLink href={`/me/listings?edit=${tool._id}`} variant="secondary" className="w-full">
                  <Pencil className="size-4" aria-hidden /> Edit listing
                </ButtonLink>
              ) : tool.removed ? null : openRequest ? (
                <div className="space-y-2">
                  <Button className="w-full" disabled>
                    Request pending
                  </Button>
                  <ButtonLink href={`/me/requests?loan=${openRequest._id}`} variant="ghost" className="w-full">
                    View my request
                  </ButtonLink>
                </div>
              ) : (
                <Button className="w-full" size="lg" onClick={() => setRequestOpen(true)}>
                  Request to borrow
                </Button>
              )}
            </div>
          </Card>

          {tool.myLoans.length > 0 && (
            <Card className="p-6">
              <h2 className="text-sm font-medium uppercase tracking-wide text-ink-faint">Your history with this tool</h2>
              <ul className="mt-3 space-y-2.5">
                {tool.myLoans.map((l) => (
                  <li key={l._id} className="flex items-center justify-between gap-2 text-sm">
                    <Link href={`/me/requests?loan=${l._id}`} className="text-ink-soft hover:text-ink">
                      {dateRange(l.startDate, l.endDate)}{" "}
                      <span className="text-ink-faint">· {nights(l.startDate, l.endDate)}</span>
                    </Link>
                    <LoanStatusBadge phase={rawStatusPhase(l.status)} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>

      {!tool.isMine && !tool.removed && (
        <RequestDialog
          open={requestOpen}
          onClose={() => {
            setRequestOpen(false);
            if (params.get("request")) router.replace(`/tools/${tool._id}`, { scroll: false });
          }}
          tool={{ _id: tool._id, name: tool.name, ownerName: tool.owner.name }}
          today={today}
          booked={tool.booked}
        />
      )}
    </div>
  );
}
