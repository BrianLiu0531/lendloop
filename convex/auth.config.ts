import type { AuthConfig } from "convex/server";

/**
 * Convex verifies every Clerk-issued JWT against this issuer's JWKS and
 * requires `aud: "convex"` (Clerk's Convex integration / "convex" JWT template).
 */
export default {
  providers: [
    {
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
