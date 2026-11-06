/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import schema from "./schema";

export const modules = import.meta.glob("./**/*.ts");

export const ALICE = { subject: "user_alice", tokenIdentifier: "clerk|user_alice", name: "Alice Lender", email: "alice@example.com", emailVerified: true };
export const BOB = { subject: "user_bob", tokenIdentifier: "clerk|user_bob", name: "Bob Borrower", email: "bob@example.com", emailVerified: true };
export const CAROL = { subject: "user_carol", tokenIdentifier: "clerk|user_carol", name: "Carol Other", email: "carol@example.com", emailVerified: true };
export const ADMIN = { subject: "user_admin", tokenIdentifier: "clerk|user_admin", name: "Ada Admin", email: "admin@example.com", emailVerified: true };

export function setup() {
  process.env.ADMIN_EMAILS = "admin@example.com";
  process.env.N8N_INBOUND_SIGNING_SECRET = "test-inbound-secret";
  process.env.N8N_OUTBOUND_SIGNING_SECRET = "test-outbound-secret";
  process.env.N8N_LOAN_EVENTS_WEBHOOK_URL = "https://n8n.test/webhook/lendloop-loan-events";
  process.env.APP_URL = "https://lendloop.test";
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  return t;
}
