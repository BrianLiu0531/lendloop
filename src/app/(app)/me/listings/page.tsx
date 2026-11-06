import type { Metadata } from "next";
import { Suspense } from "react";
import { ListingsView } from "./listings-view";

export const metadata: Metadata = { title: "My listings" };

export default function ListingsPage() {
  return (
    <Suspense>
      <ListingsView />
    </Suspense>
  );
}
