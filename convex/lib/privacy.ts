import type { Doc } from "../_generated/dataModel";

/**
 * The only form in which one user's identity is shown to another: a first
 * name. Enough to be neighborly, not enough to look someone up.
 */
export function publicName(user: Doc<"users"> | null) {
  return user?.name.trim().split(/\s+/)[0] || "A neighbor";
}
