"use client";

import { useQuery } from "convex/react";
import { Lock } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { CategoryIcon } from "@/components/category-icon";
import { Skeleton } from "@/components/ui/primitives";
import { CATEGORY } from "@/lib/catalog";

/** Read-only, anonymous view: name + category only, straight from Convex. */
export function PublicToolList() {
  const tools = useQuery(api.tools.listPublic);

  if (tools === undefined) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-[4.5rem] rounded-xl" />
        ))}
      </div>
    );
  }

  if (tools.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-line-strong bg-surface/70 px-6 py-10 text-center text-ink-soft">
        The shelf is empty — be the first neighbor to list a tool.
      </p>
    );
  }

  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool, i) => (
          <li
            key={`${tool.name}-${i}`}
            className="flex animate-fade-up items-center gap-3.5 rounded-xl border border-line bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]"
            style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}
          >
            <CategoryIcon category={tool.category} />
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{tool.name}</p>
              <p className="text-sm text-ink-faint">{CATEGORY[tool.category].label}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-ink-soft">
        <Lock className="size-3.5" aria-hidden />
        Who owns what — and when it&apos;s free — is only visible to signed-in neighbors.
      </p>
    </>
  );
}

/** The hero's one fact line: how many tools are listed right now (same query, deduplicated by Convex). */
export function ShelfCount() {
  const tools = useQuery(api.tools.listPublic);
  const n = tools?.length;
  return (
    <p className="mb-6 inline-flex items-center gap-2 text-[15px] text-ink-soft" aria-live="polite">
      <span className="size-2 rounded-full bg-brand" aria-hidden />
      {n === undefined ? "A tool library for your street" : `${n} ${n === 1 ? "tool" : "tools"} on the shelf right now, free to borrow`}
    </p>
  );
}
