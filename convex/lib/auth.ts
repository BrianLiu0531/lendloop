import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { appError, forbidden } from "./errors";

export type Viewer = Doc<"users">;

/**
 * Resolves the signed-in user from the verified Clerk JWT. Identity is
 * always derived server-side from `ctx.auth`; no function accepts a user id
 * argument for authorization.
 */
export async function getViewer(ctx: QueryCtx | MutationCtx): Promise<Viewer | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  return await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
    .unique();
}

export async function requireViewer(ctx: QueryCtx | MutationCtx): Promise<Viewer> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw appError("UNAUTHENTICATED", "Please sign in to continue.");
  const viewer = await getViewer(ctx);
  // Signed in with Clerk but the profile row hasn't been created yet
  // (users.ensure runs right after sign-in on the client).
  if (!viewer) throw appError("UNAUTHENTICATED", "Your profile is still being set up. Try again.");
  return viewer;
}

export function isAdmin(viewer: Viewer | null): boolean {
  return viewer?.role === "admin";
}

export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Viewer> {
  const viewer = await requireViewer(ctx);
  if (!isAdmin(viewer)) throw forbidden("Only admins can do that.");
  return viewer;
}
