import { auth } from "@clerk/nextjs/server";
import { Suspense, type ReactNode } from "react";
import { AppShell } from "@/components/app-shell";

/** Server-side gate: signed-out visitors are redirected to sign in before any app UI renders. */
async function RequireSignIn({ children }: { children: ReactNode }) {
  await auth.protect();
  return <>{children}</>;
}

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <AppShell>
      <Suspense fallback={null}>
        <RequireSignIn>{children}</RequireSignIn>
      </Suspense>
    </AppShell>
  );
}
