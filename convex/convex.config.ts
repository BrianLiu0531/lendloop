import { defineApp } from "convex/server";
import { v } from "convex/values";
import rateLimiter from "@convex-dev/rate-limiter/convex.config";

/**
 * Typed deployment environment. Every secret lives here (set with
 * `npx convex env set`), never in source. Optional entries let the app boot
 * before automation is configured — the outbox then records a visible
 * "not configured" failure instead of silently dropping events.
 */
const app = defineApp({
  env: {
    /** Clerk Frontend API URL, i.e. the JWT issuer (https://<slug>.clerk.accounts.dev). */
    CLERK_JWT_ISSUER_DOMAIN: v.string(),
    /** Comma-separated emails that are promoted to admin on first sign-in. */
    ADMIN_EMAILS: v.optional(v.string()),
    /** n8n Webhook URL for loan events (Convex -> n8n). */
    N8N_LOAN_EVENTS_WEBHOOK_URL: v.optional(v.string()),
    /** HMAC key Convex uses to sign outbound webhooks (Convex -> n8n). */
    N8N_OUTBOUND_SIGNING_SECRET: v.optional(v.string()),
    /** HMAC key n8n uses to sign calls into the Convex HTTP API (n8n -> Convex). */
    N8N_INBOUND_SIGNING_SECRET: v.optional(v.string()),
    /** Public URL of the web app, used for deep links inside notifications. */
    APP_URL: v.optional(v.string()),
  },
});

app.use(rateLimiter);

export default app;
