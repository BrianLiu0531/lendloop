import { CATEGORY, type Category } from "@/lib/catalog";
import { cn } from "@/lib/cn";

export function CategoryIcon({ category, size = "md" }: { category: Category; size?: "sm" | "md" | "lg" }) {
  const meta = CATEGORY[category];
  const Icon = meta.icon;
  const box = { sm: "size-8 rounded-lg", md: "size-11 rounded-xl", lg: "size-16 rounded-2xl" }[size];
  const icon = { sm: "size-4", md: "size-5", lg: "size-7" }[size];
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", box, meta.tint, meta.ink)} aria-hidden>
      <Icon className={icon} strokeWidth={1.8} />
    </span>
  );
}
