"use client";

import { useQuery } from "convex/react";
import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { api } from "../../../../../convex/_generated/api";
import { LoanStatusBadge } from "@/components/loan-status";
import { Card, Select, Skeleton } from "@/components/ui/primitives";
import { useToday } from "@/hooks/use-today";
import { ago, dateRange } from "@/lib/format";

const STATUSES = ["pending", "approved", "returned", "declined", "cancelled"] as const;
type Status = (typeof STATUSES)[number];

export function LoansTab() {
  const today = useToday();
  const [status, setStatus] = useState<Status | "">("");
  const loans = useQuery(api.admin.loans, today ? { today, status: status || undefined } : "skip");

  return (
    <>
      <div className="mb-4 flex items-center gap-3">
        <label htmlFor="loan-status" className="text-sm text-ink-soft">
          Status
        </label>
        <Select id="loan-status" className="w-48" value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
          <option value="">All loans</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s[0].toUpperCase() + s.slice(1)}
            </option>
          ))}
        </Select>
        {loans && <span className="text-sm text-ink-faint">{loans.length} shown</span>}
      </div>
      {!loans ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Tool</th>
                <th className="px-4 py-3 font-medium">Lender</th>
                <th className="px-4 py-3 font-medium">Borrower</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requested</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loans.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-ink-faint">
                    No loans.
                  </td>
                </tr>
              )}
              {loans.map((l) => (
                <tr key={l._id}>
                  <td className="px-4 py-3 font-medium">
                    {l.toolName}
                    {l.deadEvents > 0 && (
                      <AlertTriangle className="ml-1.5 inline size-3.5 text-danger" aria-label="Has failed notifications" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{l.lender}</td>
                  <td className="px-4 py-3 text-ink-soft">{l.borrower}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{dateRange(l.startDate, l.endDate)}</td>
                  <td className="px-4 py-3">
                    <LoanStatusBadge phase={l.phase} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-faint">{ago(l.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
