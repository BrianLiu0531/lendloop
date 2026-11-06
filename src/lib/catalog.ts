import {
  Truck,
  Baby,
  Bike,
  ChefHat,
  Drill,
  Leaf,
  Package,
  Sparkles,
  Tent,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Category, Condition } from "../../convex/lib/validators";

export { CATEGORIES, CONDITIONS } from "../../convex/lib/validators";
export type { Category, Condition };

type CategoryMeta = { label: string; icon: LucideIcon; tint: string; ink: string };

export const CATEGORY: Record<Category, CategoryMeta> = {
  power_tools: { label: "Power tools", icon: Drill, tint: "bg-[#fde9d9]", ink: "text-[#9a4a12]" },
  hand_tools: { label: "Hand tools", icon: Wrench, tint: "bg-[#e7e9f5]", ink: "text-[#3b4687]" },
  garden: { label: "Garden", icon: Leaf, tint: "bg-[#e1f0e2]", ink: "text-[#2f6b35]" },
  kitchen: { label: "Kitchen", icon: ChefHat, tint: "bg-[#fbe7ec]", ink: "text-[#9b2c4a]" },
  camping: { label: "Camping", icon: Tent, tint: "bg-[#e6efe9]", ink: "text-[#2d5a46]" },
  cleaning: { label: "Cleaning", icon: Sparkles, tint: "bg-[#e3f1f6]", ink: "text-[#1f5f78]" },
  ladders: { label: "Ladders & moving", icon: Truck, tint: "bg-[#f3ece0]", ink: "text-[#7a5523]" },
  sports: { label: "Sports & outdoors", icon: Bike, tint: "bg-[#eee6f6]", ink: "text-[#5b3b86]" },
  kids: { label: "Kids & baby", icon: Baby, tint: "bg-[#fdf3d7]", ink: "text-[#8a6410]" },
  other: { label: "Other", icon: Package, tint: "bg-[#eceae6]", ink: "text-[#55524b]" },
};

export const CONDITION: Record<Condition, { label: string; hint: string }> = {
  like_new: { label: "Like new", hint: "Barely used, all parts included" },
  good: { label: "Good", hint: "Works perfectly, light wear" },
  fair: { label: "Fair", hint: "Works, visible wear or quirks" },
  well_used: { label: "Well used", hint: "Works, but has seen a lot of projects" },
};
