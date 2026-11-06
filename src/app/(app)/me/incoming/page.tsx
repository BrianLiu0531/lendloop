import type { Metadata } from "next";
import { Suspense } from "react";
import { LoansPage } from "@/components/loans-page";

export const metadata: Metadata = { title: "Incoming requests" };

export default function IncomingPage() {
  return (
    <Suspense>
      <LoansPage perspective="lender" />
    </Suspense>
  );
}
