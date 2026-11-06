"use client";

import { useMutation, useQuery } from "convex/react";
import { BadgeCheck } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { Avatar, Badge, Button, Card, Select, Skeleton } from "@/components/ui/primitives";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";

export function MembersTab() {
  const members = useQuery(api.admin.members);
  const setTrusted = useMutation(api.admin.setTrustedLender);
  const setRole = useMutation(api.admin.setRole);

  if (!members) return <Skeleton className="h-64" />;

  const act = (p: Promise<unknown>, ok: string) => p.then(() => toast.success(ok)).catch((e) => toast.error(errorMessage(e)));

  return (
    <Card className="divide-y divide-line">
      {members.map((m) => (
        <div key={m._id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar name={m.name} src={m.imageUrl} size={36} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                {m.name}
                {m.isMe && <Badge>You</Badge>}
                {m.trustedLender && (
                  <Badge tone="trust">
                    <BadgeCheck className="size-3" aria-hidden /> Trusted Lender
                  </Badge>
                )}
              </p>
              <p className="truncate text-xs text-ink-faint">
                {m.email ?? "no email"} · joined {ago(m.joinedAt)} · {m.activeListings} listing{m.activeListings === 1 ? "" : "s"} ·{" "}
                {m.completedLoans} completed loan{m.completedLoans === 1 ? "" : "s"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={m.trustedLender ? "secondary" : "subtle"}
              onClick={() =>
                act(
                  setTrusted({ userId: m._id as Id<"users">, trusted: !m.trustedLender }),
                  m.trustedLender ? `${m.name} is no longer a Trusted Lender` : `${m.name} is now a Trusted Lender`,
                )
              }
            >
              {m.trustedLender ? "Remove trusted" : "Mark trusted"}
            </Button>
            <Select
              aria-label={`Role for ${m.name}`}
              className="h-8 w-28 text-xs"
              value={m.role}
              disabled={m.isMe}
              title={m.isMe ? "You can't change your own role" : undefined}
              onChange={(e) =>
                act(setRole({ userId: m._id, role: e.target.value as "user" | "admin" }), `${m.name} is now ${e.target.value}`)
              }
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
        </div>
      ))}
    </Card>
  );
}
