import { v } from "convex/values";
import { env, mutation, query } from "./_generated/server";
import { getViewer } from "./lib/auth";
import { appError } from "./lib/errors";

function adminAllowlist(): Set<string> {
  return new Set(
    (env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * Creates or refreshes the caller's profile from their verified Clerk token.
 * Called by the client once per session. Profile fields are copied from the
 * JWT, never from arguments, so users can't spoof their name or email.
 *
 * Admin bootstrap: an email on ADMIN_EMAILS becomes admin only if Clerk says
 * it is verified. After that, roles are managed in-app and audited.
 */
export const ensure = mutation({
  args: {},
  returns: v.id("users"),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw appError("UNAUTHENTICATED", "Please sign in to continue.");

    const email = identity.email?.toLowerCase();
    const name =
      identity.name?.trim() || identity.givenName?.trim() || email?.split("@")[0] || "Neighbor";
    const shouldBeAdmin = !!email && identity.emailVerified !== false && adminAllowlist().has(email);

    const existing = await getViewer(ctx);
    if (existing) {
      const patch: Partial<typeof existing> = {};
      if (existing.name !== name) patch.name = name;
      if (existing.email !== email) patch.email = email;
      if (existing.imageUrl !== identity.pictureUrl) patch.imageUrl = identity.pictureUrl;
      if (shouldBeAdmin && existing.role !== "admin") patch.role = "admin";
      if (Object.keys(patch).length > 0) await ctx.db.patch("users", existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("users", {
      tokenIdentifier: identity.tokenIdentifier,
      name,
      email,
      imageUrl: identity.pictureUrl,
      role: shouldBeAdmin ? "admin" : "user",
      trustedLender: false,
    });
  },
});

/** The caller's own profile (or null when signed out / not yet created). */
export const me = query({
  args: {},
  handler: async (ctx) => {
    const viewer = await getViewer(ctx);
    if (!viewer) return null;
    return {
      _id: viewer._id,
      name: viewer.name,
      email: viewer.email ?? null,
      imageUrl: viewer.imageUrl ?? null,
      role: viewer.role,
      trustedLender: viewer.trustedLender,
    };
  },
});
