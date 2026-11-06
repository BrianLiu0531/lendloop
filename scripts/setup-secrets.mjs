#!/usr/bin/env node
/**
 * One-time local setup for the Convex <-> n8n integration.
 *
 *   node scripts/setup-secrets.mjs [--rotate]
 *
 * 1. Creates n8n/.env from n8n/.env.example with freshly generated secrets
 *    (or reuses the existing file; --rotate regenerates the two signing keys).
 * 2. Pushes the matching values into the current Convex deployment with
 *    `npx convex env set`, so both sides always agree.
 *
 * Secrets only ever live in git-ignored files and the Convex/n8n env —
 * never in source or exported workflow JSON.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, "n8n/.env");
const examplePath = resolve(root, "n8n/.env.example");
const rotate = process.argv.includes("--rotate");
const secret = () => randomBytes(32).toString("hex");

function parse(text) {
  const map = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) map.set(m[1], m[2]);
  }
  return map;
}

let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : readFileSync(examplePath, "utf8");
const values = parse(text);
const generated = [];
function ensure(key, force = false) {
  if (!force && values.get(key)) return;
  const value = secret();
  values.set(key, value);
  text = text.replace(new RegExp(`^${key}=.*$`, "m"), `${key}=${value}`);
  generated.push(key);
}
ensure("N8N_ENCRYPTION_KEY");
ensure("N8N_DB_PASSWORD");
ensure("LENDLOOP_OUTBOUND_SIGNING_SECRET", rotate);
ensure("LENDLOOP_INBOUND_SIGNING_SECRET", rotate);
writeFileSync(envPath, text);
console.log(`✔ n8n/.env ${generated.length ? `(generated: ${generated.join(", ")})` : "(unchanged)"}`);

const convexEnv = {
  N8N_OUTBOUND_SIGNING_SECRET: values.get("LENDLOOP_OUTBOUND_SIGNING_SECRET"),
  N8N_INBOUND_SIGNING_SECRET: values.get("LENDLOOP_INBOUND_SIGNING_SECRET"),
  N8N_LOAN_EVENTS_WEBHOOK_URL:
    process.env.N8N_LOAN_EVENTS_WEBHOOK_URL ?? "http://localhost:5678/webhook/lendloop-loan-events",
  APP_URL: process.env.APP_URL ?? "http://localhost:3000",
};
// Run the Convex CLI directly with node (no shell), so secret values are
// passed as plain argv and never interpreted or echoed by a shell.
const convexCli = resolve(root, "node_modules/convex/bin/main.js");
for (const [key, value] of Object.entries(convexEnv)) {
  execFileSync(process.execPath, [convexCli, "env", "set", key, value], {
    cwd: root,
    stdio: ["ignore", "ignore", "inherit"],
  });
  console.log(`✔ convex env ${key}`);
}
console.log("\nNext: npm run n8n:up && npm run n8n:import");
