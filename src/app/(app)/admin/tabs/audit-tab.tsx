"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Card, Skeleton } from "@/components/ui/primitives";
import { ago } from "@/lib/format";

const LABEL: Record<string, string> = {
  "tool.removed": "removed a listing",
  "user.trusted": "marked a Trusted Lender",
  "user.untrusted": "removed Trusted Lender",
  "user.role_changed": "changed a role",
  "outbox.retried": "retried a notification",
  "automation.failed": "reported a workflow failure",
  "automation.failure_acknowledged": "acknowledged a failure",
};

export function AuditTab() {
  const rows = useQuery(api.admin.auditLog);
  if (!rows) return <Skeleton className="h-64" />;
  return (
    <Card className="divide-y divide-line">
      {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No privileged actions yet.</p>}
      {rows.map((r) => (
        <div key={r._id} className="flex items-baseline justify-between gap-4 px-5 py-3 text-sm">
          <p>
            <span className="font-medium text-ink">{r.actor}</span>{" "}
            <span className="text-ink-soft">{LABEL[r.action] ?? r.action}</span>
            {r.detail && <span className="text-ink-faint"> — {r.detail}</span>}
          </p>
          <span className="shrink-0 text-xs text-ink-faint" title={new Date(r.at).toLocaleString()}>
            {ago(r.at)}
          </span>
        </div>
      ))}
    </Card>
  );
}
