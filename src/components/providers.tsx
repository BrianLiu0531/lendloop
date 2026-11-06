"use client";

import { useAuth } from "@clerk/nextjs";
import { ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { useEffect, useRef, type ReactNode } from "react";
import { api } from "../../convex/_generated/api";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Creates/refreshes the caller's Convex profile once per authenticated
 * session. Profile fields come from the verified JWT on the server.
 */
function EnsureProfile() {
  const { isAuthenticated } = useConvexAuth();
  const ensure = useMutation(api.users.ensure);
  const done = useRef(false);
  useEffect(() => {
    if (!isAuthenticated) {
      done.current = false;
      return;
    }
    if (done.current) return;
    done.current = true;
    ensure().catch(() => {
      done.current = false;
    });
  }, [isAuthenticated, ensure]);
  return null;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return (
    <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
      <EnsureProfile />
      {children}
    </ConvexProviderWithClerk>
  );
}
