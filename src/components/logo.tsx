import Link from "next/link";

export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <rect width="32" height="32" rx="9" fill="#2d6a4f" />
      <path
        d="M11.5 20.5a4.5 4.5 0 1 1 0-9c2.2 0 3.4 1.6 4.5 4.5s2.3 4.5 4.5 4.5a4.5 4.5 0 1 0 0-9"
        stroke="#faf7f2"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <circle cx="20.5" cy="11.5" r="1.6" fill="#f2c46d" />
    </svg>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 rounded-lg" aria-label="LendLoop home">
      <LogoMark />
      <span className="font-display text-xl font-semibold tracking-tight text-ink">LendLoop</span>
    </Link>
  );
}
