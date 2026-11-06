import Link from "next/link";
import type { Id } from "../../convex/_generated/dataModel";
import { AvailabilityBadge, type Availability } from "@/components/availability-badge";
import { CategoryIcon } from "@/components/category-icon";
import { TrustedMark } from "@/components/trusted-badge";
import { Badge } from "@/components/ui/primitives";
import { CATEGORY, CONDITION, type Category, type Condition } from "@/lib/catalog";

export type BoardTool = {
  _id: Id<"tools">;
  name: string;
  category: Category;
  condition: Condition;
  description: string;
  isMine: boolean;
  owner: { name: string; trustedLender: boolean };
  availability: Availability;
  iHaveRequested: boolean;
};

export function ToolCard({ tool, index = 0 }: { tool: BoardTool; index?: number }) {
  return (
    <Link
      href={`/tools/${tool._id}`}
      className="group flex animate-fade-up flex-col rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-line-strong hover:shadow-[var(--shadow-lift)]"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <CategoryIcon category={tool.category} />
        <div className="flex flex-wrap justify-end gap-1.5">
          {tool.isMine && <Badge tone="info">Yours</Badge>}
          {tool.iHaveRequested && <Badge tone="neutral">Requested</Badge>}
        </div>
      </div>
      <h3 className="mt-4 font-display text-xl leading-snug text-ink group-hover:text-brand-strong">{tool.name}</h3>
      <p className="mt-0.5 text-sm text-ink-faint">
        {CATEGORY[tool.category].label} · {CONDITION[tool.condition].label}
      </p>
      {tool.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink-soft">{tool.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <span className="flex items-center gap-1.5 text-sm text-ink-soft">
          {tool.isMine ? "You" : tool.owner.name}
          {tool.owner.trustedLender && <TrustedMark />}
        </span>
        <AvailabilityBadge availability={tool.availability} />
      </div>
    </Link>
  );
}
