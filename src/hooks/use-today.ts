"use client";

import { useSyncExternalStore } from "react";
import { localIsoDate } from "@/lib/format";

// Re-check the date every minute so a tab left open overnight rolls over.
function subscribe(onChange: () => void) {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/**
 * The user's local calendar date (YYYY-MM-DD), or null during server
 * rendering. Convex queries take "today" as an argument because queries
 * must be deterministic and can't read the clock themselves.
 */
export function useToday(): string | null {
  return useSyncExternalStore(subscribe, () => localIsoDate(), () => null);
}
