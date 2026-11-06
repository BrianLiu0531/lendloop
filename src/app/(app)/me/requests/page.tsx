import type { Metadata } from "next";
import { Suspense } from "react";
import { LoansPage } from "@/components/loans-page";

export const metadata: Metadata = { title: "My requests" };

export default function RequestsPage() {
  return (
    <Suspense>
      <LoansPage perspective="borrower" />
    </Suspense>
  );
}
