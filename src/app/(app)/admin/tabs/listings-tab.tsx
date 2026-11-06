"use client";

import { useMutation, useQuery } from "convex/react";
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { CategoryIcon } from "@/components/category-icon";
import { TrustedMark } from "@/components/trusted-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Button, Card, Skeleton } from "@/components/ui/primitives";
import { CATEGORY } from "@/lib/catalog";
import { errorMessage } from "@/lib/errors";
import { ago } from "@/lib/format";

export function ListingsTab() {
  const [includeRemoved, setIncludeRemoved] = useState(false);
  const tools = useQuery(api.admin.listings, { includeRemoved });
  // Admin removal goes through the same tools.remove mutation; the policy allows admins on any listing.
  const remove = useMutation(api.tools.remove);
  const [target, setTarget] = useState<{ _id: Id<"tools">; name: string; owner: string } | null>(null);

  return (
    <>
      <label className="mb-4 flex w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft">
        <input type="checkbox" className="size-4 accent-brand" checked={includeRemoved} onChange={(e) => setIncludeRemoved(e.target.checked)} />
        Show removed listings
      </label>
      {!tools ? (
        <Skeleton className="h-64" />
      ) : (
        <Card className="divide-y divide-line">
          {tools.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-faint">No listings.</p>}
          {tools.map((t) => (
            <div key={t._id} className="flex items-center gap-4 px-5 py-3.5">
              <CategoryIcon category={t.category} size="sm" />
              <div className="min-w-0 flex-1">
                <Link href={`/tools/${t._id}`} className="font-medium text-ink hover:text-brand-strong">
                  {t.name}
                </Link>
                <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                  {CATEGORY[t.category].label} · by {t.owner.name} {t.owner.trustedLender && <TrustedMark />} · listed {ago(t.createdAt)}
                </p>
              </div>
              {t.removedAt ? (
                <Badge tone="danger" title={t.removalReason ?? undefined}>
                  Removed {ago(t.removedAt)}
                  {t.removalReason ? ` · ${t.removalReason}` : ""}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setTarget({ _id: t._id, name: t.name, owner: t.owner.name })}
                >
                  <Trash2 className="size-4" aria-hidden /> Remove
                </Button>
              )}
            </div>
          ))}
        </Card>
      )}
      <ConfirmDialog
        open={!!target}
        onClose={() => setTarget(null)}
        title={`Remove "${target?.name}"?`}
        confirmLabel="Remove listing"
        reasonLabel="Reason (kept in the audit log)"
        onConfirm={async (reason) => {
          if (!target) return;
          try {
            await remove({ toolId: target._id, reason });
            toast.success("Listing removed");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        This hides {target?.owner}&apos;s listing from everyone. Pending requests are declined and future bookings
        cancelled, with notifications to the borrowers.
      </ConfirmDialog>
    </>
  );
}
