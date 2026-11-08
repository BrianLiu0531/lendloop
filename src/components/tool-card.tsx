import Link from "next/link";
import type { Id } from "../../convex/_generated/dataModel";
import { AvailabilityBadge, type Availability } from "@/components/availability-badge";
import { CategoryArt } from "@/components/category-icon";
import { TrustedMark } from "@/components/trusted-badge";
import { Badge } from "@/components/ui/primitives";
import { CATEGORY, CONDITION, type Category, type Condition } from "@/lib/catalog";
import { cn } from "@/lib/cn";

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
  coverUrl: string | null;
};

export function ToolCard({ tool, index = 0 }: { tool: BoardTool; index?: number }) {
  return (
    <Link
      href={`/tools/${tool._id}`}
      className="group flex animate-fade-up flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface transition-[border-color,box-shadow] duration-200 hover:border-line-strong hover:shadow-[var(--shadow-hover)]"
      style={{ animationDelay: `${Math.min(index, 12) * 25}ms` }}
    >
      <div className={cn("relative aspect-[4/3] overflow-hidden", !tool.coverUrl && CATEGORY[tool.category].tint)}>
        {tool.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Convex storage URL
          <img
            src={tool.coverUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <CategoryArt
              category={tool.category}
              className="size-24 drop-shadow-[0_10px_14px_rgba(29,39,33,0.18)] transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110"
            />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {tool.isMine && <Badge tone="info">Yours</Badge>}
          {tool.iHaveRequested && <Badge tone="neutral">Requested</Badge>}
        </div>
        <div className="absolute bottom-3 right-3">
          <AvailabilityBadge availability={tool.availability} />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[13px] font-medium text-ink-faint">
          {CATEGORY[tool.category].label} · {CONDITION[tool.condition].label}
        </p>
        <h3 className="mt-1 font-display text-xl leading-snug text-ink group-hover:text-brand-strong">{tool.name}</h3>
        {tool.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-soft">{tool.description}</p>}
        <div className="mt-auto flex items-center gap-2 pt-4 text-sm text-ink-soft">
          <span className="flex size-6 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand-strong">
            {(tool.isMine ? "Y" : tool.owner.name[0] ?? "?").toUpperCase()}
          </span>
          {tool.isMine ? "You" : tool.owner.name}
          {tool.owner.trustedLender && <TrustedMark />}
        </div>
      </div>
    </Link>
  );
}
