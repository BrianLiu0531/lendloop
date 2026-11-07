import { CATEGORY, type Category } from "@/lib/catalog";
import { cn } from "@/lib/cn";

const BOX = { sm: "size-9 rounded-lg", md: "size-12 rounded-xl", lg: "size-20 rounded-2xl" } as const;
const ART = { sm: "size-6", md: "size-8", lg: "size-14" } as const;

/**
 * Square thumbnail for a tool: its cover photo when there is one, otherwise
 * the category's 3D illustration (Microsoft Fluent Emoji, MIT) on a tint.
 */
export function CategoryIcon({
  category,
  photoUrl,
  size = "md",
}: {
  category: Category;
  photoUrl?: string | null;
  size?: keyof typeof BOX;
}) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Convex storage URLs; sizes are tiny
      <img src={photoUrl} alt="" className={cn("shrink-0 object-cover", BOX[size])} loading="lazy" />
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center", BOX[size], CATEGORY[category].tint)} aria-hidden>
      <CategoryArt category={category} className={ART[size]} />
    </span>
  );
}

export function CategoryArt({ category, className }: { category: Category; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static 256px PNGs from /public
  return <img src={`/art/${category}.png`} alt="" className={cn("select-none", className)} draggable={false} />;
}
