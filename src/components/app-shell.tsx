"use client";

import { SignInButton, UserButton } from "@clerk/nextjs";
import { Authenticated, AuthLoading, Unauthenticated, useQuery } from "convex/react";
import { Inbox, LayoutGrid, Loader2, Package, Send, Shield } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { api } from "../../convex/_generated/api";
import { Logo } from "@/components/logo";
import { Badge, buttonClass } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";

function NavLink({ href, icon, label, count }: { href: string; icon: ReactNode; label: string; count?: number }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-ink text-paper" : "text-ink-soft hover:bg-sunken hover:text-ink",
      )}
    >
      {icon}
      <span>{label}</span>
      {!!count && (
        <span
          className={cn(
            "ml-0.5 min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums",
            active ? "bg-paper/20 text-paper" : "bg-brand text-white",
          )}
          aria-label={`${count} waiting`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

function Nav() {
  const me = useQuery(api.users.me);
  const counts = useQuery(api.loans.navCounts, me ? {} : "skip");
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:pb-0" aria-label="Main">
      <NavLink href="/board" icon={<LayoutGrid className="size-4" />} label="Board" />
      <NavLink href="/me/listings" icon={<Package className="size-4" />} label="My listings" />
      <NavLink href="/me/requests" icon={<Send className="size-4" />} label="My requests" />
      <NavLink
        href="/me/incoming"
        icon={<Inbox className="size-4" />}
        label="Incoming"
        count={counts?.incomingPending}
      />
      {me?.role === "admin" && <NavLink href="/admin" icon={<Shield className="size-4" />} label="Admin" />}
    </nav>
  );
}

function FullPageSpinner({ label }: { label: string }) {
  return (
    <div className="flex flex-1 items-center justify-center py-32 text-ink-faint" role="status">
      <Loader2 className="mr-2 size-5 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/** Waits for the Convex profile row before rendering pages that need it. */
function ProfileGate({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  if (!me) return <FullPageSpinner label="Setting up your profile…" />;
  return <>{children}</>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const me = useQuery(api.users.me);
  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-line bg-paper">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:gap-6 sm:px-8">
          <div className="flex items-center justify-between">
            <Logo href="/board" />
            <div className="sm:hidden">
              <UserButton />
            </div>
          </div>
          <Authenticated>
            <Nav />
          </Authenticated>
          <div className="ml-auto hidden items-center gap-3 sm:flex">
            {me?.trustedLender && (
              <Badge tone="trust" title="Marked as a Trusted Lender by an admin">
                Trusted Lender
              </Badge>
            )}
            {me?.role === "admin" && <Badge tone="info">Admin</Badge>}
            <UserButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-8">
        <AuthLoading>
          <FullPageSpinner label="Loading…" />
        </AuthLoading>
        <Unauthenticated>
          <div className="mx-auto max-w-md py-24 text-center">
            <h1 className="font-display text-3xl">Sign in to continue</h1>
            <p className="mt-2 text-ink-soft">The board is only visible to signed-in neighbors.</p>
            <SignInButton mode="modal">
              <button className={cn(buttonClass("primary", "lg"), "mt-6")}>Sign in</button>
            </SignInButton>
          </div>
        </Unauthenticated>
        <Authenticated>
          <ProfileGate>{children}</ProfileGate>
        </Authenticated>
      </main>
    </div>
  );
}
