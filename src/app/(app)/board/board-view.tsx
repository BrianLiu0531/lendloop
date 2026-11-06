"use client";

import { useQuery } from "convex/react";
import { PackageOpen, Plus, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { api } from "../../../../convex/_generated/api";
import { ToolCard } from "@/components/tool-card";
import { ButtonLink, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui/primitives";
import { useToday } from "@/hooks/use-today";
import { CATEGORIES, CATEGORY, type Category } from "@/lib/catalog";
import { cn } from "@/lib/cn";

function isCategory(value: string | null): value is Category {
  return !!value && (CATEGORIES as readonly string[]).includes(value);
}

export function BoardView() {
  const today = useToday();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const rawCategory = params.get("category");
  const category = isCategory(rawCategory) ? rawCategory : undefined;
  const [search, setSearch] = useState("");
  const [availableOnly, setAvailableOnly] = useState(false);

  // Category filtering happens in Convex (indexed); text search is client-side over the result.
  const tools = useQuery(api.tools.list, today ? { today, category } : "skip");

  const visible = useMemo(() => {
    if (!tools) return undefined;
    const q = search.trim().toLowerCase();
    return tools.filter(
      (t) =>
        (!availableOnly || t.availability.state === "available") &&
        (!q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)),
    );
  }, [tools, search, availableOnly]);

  function setCategory(next?: Category) {
    const sp = new URLSearchParams(params);
    if (next) sp.set("category", next);
    else sp.delete("category");
    router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`, { scroll: false });
  }

  const availableCount = tools?.filter((t) => t.availability.state === "available").length;

  return (
    <>
      <PageHeader
        title="The board"
        description={
          tools
            ? `${tools.length} tool${tools.length === 1 ? "" : "s"}${category ? ` in ${CATEGORY[category].label.toLowerCase()}` : ""} · ${availableCount} available today`
            : "Everything your neighbors are lending."
        }
        action={
          <ButtonLink href="/me/listings?new=1">
            <Plus className="size-4" aria-hidden /> List a tool
          </ButtonLink>
        }
      />

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search drills, tents, ladders…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              aria-label="Search tools"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft select-none">
            <input
              type="checkbox"
              checked={availableOnly}
              onChange={(e) => setAvailableOnly(e.target.checked)}
              className="size-4 rounded accent-brand"
            />
            Available today only
          </label>
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Filter by category">
          <Chip active={!category} onClick={() => setCategory()}>
            All
          </Chip>
          {CATEGORIES.map((c) => {
            const Icon = CATEGORY[c].icon;
            return (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>
                <Icon className="size-3.5" aria-hidden />
                {CATEGORY[c].label}
              </Chip>
            );
          })}
        </div>
      </div>

      {visible === undefined ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 rounded-[var(--radius-card)]" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<PackageOpen className="size-5" />}
          title={tools?.length ? "No matches" : "Nothing here yet"}
          action={
            tools?.length ? undefined : (
              <ButtonLink href="/me/listings?new=1">
                <Plus className="size-4" aria-hidden /> List the first one
              </ButtonLink>
            )
          }
        >
          {tools?.length ? "Try another category or clear your search." : "Nobody has listed a tool in this category yet."}
        </EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((tool, i) => (
            <ToolCard key={tool._id} tool={tool} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
        active
          ? "border-ink bg-ink text-paper"
          : "border-line-strong bg-surface text-ink-soft hover:border-ink-faint hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
