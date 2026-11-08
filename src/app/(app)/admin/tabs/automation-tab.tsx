"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, BellRing, CheckCircle2, Clock, ExternalLink, Mail, RotateCcw } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import { Badge, Button, Card, Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";

/** Wall clock rounded to the minute, so the query subscription isn't recreated every render. */
function useMinute() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 60_000) * 60_000);
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 60_000) * 60_000), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const STATUS_TONE = { delivered: "brand", queued: "neutral", retrying: "warn", dead: "danger" } as const;

export function AutomationTab() {
  const now = useMinute();
  const data = useQuery(api.admin.automation, { now });
  const retry = useMutation(api.admin.retryEvent);
  const acknowledge = useMutation(api.admin.acknowledgeFailure);

  if (!data) return <Skeleton className="h-96" />;
  const { sweep, counts } = data;
  const healthy = sweep && !sweep.stale && counts.dead === 0 && counts.openFailures === 0;

  return (
    <div className="space-y-8">
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl px-5 py-4",
          healthy ? "bg-brand-soft text-brand-strong" : "bg-warn-soft text-warn",
        )}
        role="status"
      >
        {healthy ? <CheckCircle2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
        <p className="text-sm font-medium">
          {healthy
            ? "All automation is healthy."
            : !sweep
              ? "The overdue sweep hasn't reported a run yet — check that the n8n workflow is active."
              : "Some automation needs attention."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat
          icon={<BellRing className="size-4" />}
          label="Daily overdue sweep"
          value={sweep ? ago(sweep.finishedAt) : "Never"}
          detail={sweep ? `${sweep.sent} sent · ${sweep.failed} failed · ${sweep.overdueCount} overdue` : "No runs reported"}
          warn={!sweep || sweep.stale}
          warnText={sweep?.stale ? "Stale — expected every 24h" : undefined}
        />
        <Stat
          icon={<Mail className="size-4" />}
          label="Loan notifications"
          value={counts.dead > 0 ? `${counts.dead} failed` : counts.retrying > 0 ? `${counts.retrying} retrying` : "Flowing"}
          detail="Convex → n8n webhook (outbox)"
          warn={counts.dead > 0}
        />
        <Stat
          icon={<AlertTriangle className="size-4" />}
          label="Workflow failures"
          value={String(counts.openFailures)}
          detail="Reported by the n8n error workflow"
          warn={counts.openFailures > 0}
        />
      </div>

      {(data.failures.length > 0 || data.deadEvents.length > 0) && (
        <section>
          <h2 className="mb-3 font-display text-xl">Needs attention</h2>
          <div className="space-y-2">
            {data.failures.map((f) => (
              <Card key={f._id} className="flex flex-col gap-3 border-danger/25 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {f.workflow}
                    {f.node && <span className="font-normal text-ink-faint"> · {f.node}</span>}
                  </p>
                  <p className="mt-0.5 break-words font-mono text-xs text-danger">{f.message}</p>
                  <p className="mt-1 text-xs text-ink-faint">{ago(f.occurredAt)}</p>
                </div>
                <div className="flex gap-2">
                  {f.executionUrl && (
                    <a href={f.executionUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-info hover:underline">
                      Execution <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                  )}
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => acknowledge({ failureId: f._id }).catch((e) => toast.error(errorMessage(e)))}
                  >
                    Acknowledge
                  </Button>
                </div>
              </Card>
            ))}
            {data.deadEvents.map((e) => (
              <Card key={e._id} className="flex flex-col gap-3 border-danger/25 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    <code className="font-mono text-xs">{e.type}</code> → {e.recipient}
                    <span className="font-normal text-ink-faint"> · {e.toolName}</span>
                  </p>
                  <p className="mt-0.5 break-words font-mono text-xs text-danger">{e.lastError}</p>
                  <p className="mt-1 text-xs text-ink-faint">
                    {e.attempts} attempt{e.attempts === 1 ? "" : "s"} · last {e.lastAttemptAt ? ago(e.lastAttemptAt) : "—"}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    retry({ outboxId: e._id })
                      .then(() => toast.success("Re-queued — same event id, so n8n will dedupe if it already got it"))
                      .catch((err) => toast.error(errorMessage(err)))
                  }
                >
                  <RotateCcw className="size-4" aria-hidden /> Retry
                </Button>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl">Recent notifications</h2>
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-[13px] font-medium text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Event</th>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Recipient</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Attempts</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.recentEvents.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                    No events yet.
                  </td>
                </tr>
              )}
              {data.recentEvents.map((e) => (
                <tr key={e._id} title={e.lastError ?? undefined}>
                  <td className="px-4 py-3 font-mono text-xs">{e.type}</td>
                  <td className="px-4 py-3">{e.toolName}</td>
                  <td className="px-4 py-3 text-ink-soft">{e.recipient}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[e.status]}>{e.status}</Badge>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{e.attempts}</td>
                  <td className="px-4 py-3 text-ink-faint">{ago(e.deliveredAt ?? e.lastAttemptAt ?? e.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl">Recent reminders</h2>
        {data.recentReminders.length === 0 ? (
          <p className="text-sm text-ink-faint">No overdue reminders have been sent yet.</p>
        ) : (
          <Card className="divide-y divide-line">
            {data.recentReminders.map((r) => (
              <div key={r._id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  {r.toolName} <span className="text-ink-faint">· for {r.asOf} via {r.channel}</span>
                </span>
                <span className="flex items-center gap-3">
                  {r.error && <span className="max-w-xs truncate font-mono text-xs text-danger">{r.error}</span>}
                  <Badge tone={r.status === "sent" ? "brand" : "danger"}>{r.status}</Badge>
                  <span className="flex items-center gap-1 text-ink-faint">
                    <Clock className="size-3.5" aria-hidden /> {ago(r.updatedAt)}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  detail,
  warn,
  warnText,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  detail: string;
  warn?: boolean;
  warnText?: string;
}) {
  return (
    <Card className={cn("p-5", warn && "border-warn/40")}>
      <p className="flex items-center gap-1.5 text-sm text-ink-faint">
        {icon}
        {label}
      </p>
      <p className={cn("mt-2 font-display text-2xl", warn ? "text-warn" : "text-ink")}>{value}</p>
      <p className="mt-1 text-xs text-ink-faint">{warnText ?? detail}</p>
    </Card>
  );
}
