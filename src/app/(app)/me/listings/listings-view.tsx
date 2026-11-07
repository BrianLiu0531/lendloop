"use client";

import { useMutation, useQuery } from "convex/react";
import { Inbox, Package, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { AvailabilityBadge } from "@/components/availability-badge";
import { CategoryIcon } from "@/components/category-icon";
import { ToolFormDialog, type ToolDraft } from "@/components/tool-form-dialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Badge, Button, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToday } from "@/hooks/use-today";
import { CATEGORY, CONDITION } from "@/lib/catalog";
import { errorMessage } from "@/lib/errors";

export function ListingsView() {
  const today = useToday();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tools = useQuery(api.tools.mine, today ? { today } : "skip");
  const remove = useMutation(api.tools.remove);
  const [deleting, setDeleting] = useState<{ _id: Id<"tools">; name: string } | null>(null);

  // Dialog state lives in the URL (?new=1 / ?edit=<id>) so the board and
  // tool pages can deep-link straight into it.
  const editId = params.get("edit");
  const creating = params.get("new") === "1";
  const editing = editId ? tools?.find((t) => t._id === editId) : undefined;
  const formOpen = creating || !!editing;
  const closeForm = () => router.replace(pathname, { scroll: false });
  const draft: ToolDraft | null = editing
    ? {
        _id: editing._id,
        name: editing.name,
        category: editing.category,
        condition: editing.condition,
        description: editing.description,
        photos: editing.photos,
      }
    : null;

  return (
    <>
      <PageHeader
        title="My listings"
        description="Tools you're lending to the neighborhood."
        action={
          <Button onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}>
            <Plus className="size-4" aria-hidden /> List a tool
          </Button>
        }
      />

      {tools === undefined ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : tools.length === 0 ? (
        <EmptyState
          icon={<Package className="size-5" />}
          title="You haven't listed anything yet"
          action={
            <Button onClick={() => router.replace(`${pathname}?new=1`, { scroll: false })}>
              <Plus className="size-4" aria-hidden /> List your first tool
            </Button>
          }
        >
          That ladder in the garage could save a neighbor a trip to the store.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {tools.map((tool, i) => (
            <li key={tool._id} className="animate-fade-up" style={{ animationDelay: `${i * 25}ms` }}>
              <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <Link href={`/tools/${tool._id}`} className="flex min-w-0 flex-1 items-center gap-4">
                  <CategoryIcon category={tool.category} photoUrl={tool.photos[0]?.url} size="lg" />
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg text-ink hover:text-brand-strong">{tool.name}</p>
                    <p className="text-sm text-ink-faint">
                      {CATEGORY[tool.category].label} · {CONDITION[tool.condition].label}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-wrap items-center gap-2">
                  {tool.pendingRequests > 0 && (
                    <Link href="/me/incoming">
                      <Badge tone="info">
                        <Inbox className="size-3" aria-hidden />
                        {tool.pendingRequests} request{tool.pendingRequests === 1 ? "" : "s"}
                      </Badge>
                    </Link>
                  )}
                  <AvailabilityBadge availability={tool.availability} />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.replace(`${pathname}?edit=${tool._id}`, { scroll: false })}
                    aria-label={`Edit ${tool.name}`}
                  >
                    <Pencil className="size-4" aria-hidden /> Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => setDeleting({ _id: tool._id, name: tool.name })}
                    aria-label={`Delete ${tool.name}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <ToolFormDialog open={formOpen} onClose={closeForm} initial={draft} />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "listing"}?`}
        confirmLabel="Delete listing"
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await remove({ toolId: deleting._id });
            toast.success("Listing deleted");
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      >
        It disappears from the board immediately. Open requests are declined and anyone with a future booking is
        notified. A loan that&apos;s already in progress keeps going until you mark it returned.
      </ConfirmDialog>
    </>
  );
}
