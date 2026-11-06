"use client";

import { useQuery } from "convex/react";
import { Activity, ClipboardList, Package, ScrollText, ShieldAlert, Users } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "../../../../convex/_generated/api";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { cn } from "@/lib/cn";
import { AuditTab } from "./tabs/audit-tab";
import { AutomationTab } from "./tabs/automation-tab";
import { ListingsTab } from "./tabs/listings-tab";
import { LoansTab } from "./tabs/loans-tab";
import { MembersTab } from "./tabs/members-tab";

const TABS = [
  { id: "automation", label: "Automation", icon: Activity },
  { id: "listings", label: "Listings", icon: Package },
  { id: "loans", label: "Loans", icon: ClipboardList },
  { id: "members", label: "Members", icon: Users },
  { id: "audit", label: "Audit log", icon: ScrollText },
] as const;
type TabId = (typeof TABS)[number]["id"];

export function AdminView() {
  const me = useQuery(api.users.me);
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const raw = params.get("tab");
  const tab: TabId = TABS.some((t) => t.id === raw) ? (raw as TabId) : "automation";

  // UI gate only — every admin query/mutation re-checks the role in Convex.
  if (me && me.role !== "admin") {
    return (
      <EmptyState icon={<ShieldAlert className="size-5" />} title="Admins only">
        You need the admin role to see this page.
      </EmptyState>
    );
  }

  return (
    <>
      <PageHeader title="Admin" description="Moderate listings, oversee loans, and keep an eye on automation." />
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => router.replace(`${pathname}?tab=${t.id}`, { scroll: false })}
            className={cn(
              "-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.id ? "border-ink text-ink" : "border-transparent text-ink-faint hover:text-ink-soft",
            )}
          >
            <t.icon className="size-4" aria-hidden />
            {t.label}
          </button>
        ))}
      </div>
      {me?.role === "admin" && (
        <>
          {tab === "automation" && <AutomationTab />}
          {tab === "listings" && <ListingsTab />}
          {tab === "loans" && <LoansTab />}
          {tab === "members" && <MembersTab />}
          {tab === "audit" && <AuditTab />}
        </>
      )}
    </>
  );
}
