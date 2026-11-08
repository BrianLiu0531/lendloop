/** Pure class-name helper: no "use client", so Server Components can call it. */
import { cn } from "@/lib/cn";

export type Variant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-strong",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-sunken",
  ghost: "text-ink-soft hover:bg-sunken hover:text-ink",
  danger: "bg-surface text-danger border border-danger/30 hover:bg-danger-soft",
  subtle: "bg-brand-soft text-brand-strong hover:bg-[#d3e6da]",
};
const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-12 px-6 text-base gap-2 rounded-lg",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-[color,background-color,border-color,transform] duration-150 active:scale-[0.98]",
    "disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}
