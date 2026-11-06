#!/usr/bin/env node
/**
 * Provisions the local n8n instance (docker compose service "n8n"):
 *
 *   node scripts/n8n-setup.mjs           # import credential + workflows, publish, restart
 *   node scripts/n8n-setup.mjs --export  # re-export workflows from n8n into n8n/workflows/
 *
 * The SMTP credential is built *inside* the container from its own env vars
 * and imported straight away (n8n encrypts it with N8N_ENCRYPTION_KEY), so
 * the plaintext never touches the host filesystem or the repo.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const compose = ["compose", "-f", resolve(root, "n8n/docker-compose.yml"), "--env-file", resolve(root, "n8n/.env")];
const WORKFLOWS = [
  // Error handler first: the others reference it by id in settings.errorWorkflow.
  { id: "lendloopErrors01", file: "error-handler.json" },
  { id: "lendloopNotify01", file: "loan-notifications.json" },
  { id: "lendloopOverdue1", file: "overdue-reminders.json" },
];

const docker = (args, opts = {}) =>
  execFileSync("docker", [...compose, ...args], { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const n8n = (cmd) => docker(["exec", "-T", "n8n", "sh", "-c", cmd]);

if (process.argv.includes("--export")) {
  for (const { id, file } of WORKFLOWS) {
    const json = JSON.parse(n8n(`n8n export:workflow --id=${id} --pretty 2>/dev/null | sed -n '/^\\[/,$p'`))[0];
    // Strip instance-specific noise so the committed file is stable and reviewable.
    for (const key of ["createdAt", "updatedAt", "versionId", "activeVersionId", "triggerCount", "shared", "isArchived", "activeVersion", "versionCounter"]) {
      delete json[key];
    }
    json.active = false;
    json.pinData = {};
    // Runtime state (e.g. the dedupe set of handled event ids) belongs to the instance, not the repo.
    json.staticData = null;
    writeFileSync(resolve(root, "n8n/workflows", file), `${JSON.stringify(json, null, 2)}\n`);
    console.log(`✔ exported ${file}`);
  }
  // Guard: exported workflows must never contain the signing secrets.
  const env = readFileSync(resolve(root, "n8n/.env"), "utf8");
  const secrets = [...env.matchAll(/^(LENDLOOP_\w*SECRET|N8N_ENCRYPTION_KEY|LENDLOOP_SMTP_PASSWORD)=(.+)$/gm)].map((m) => m[2]);
  for (const f of readdirSync(resolve(root, "n8n/workflows"))) {
    const text = readFileSync(resolve(root, "n8n/workflows", f), "utf8");
    if (secrets.some((s) => s && text.includes(s))) throw new Error(`Secret value found in ${f} — refusing to continue`);
  }
  console.log("✔ no secrets in exported workflows");
  process.exit(0);
}

console.log("• creating SMTP credential from container env");
n8n(`node -e '
  const e = process.env;
  require("fs").writeFileSync("/tmp/lendloop-cred.json", JSON.stringify([{
    id: "lendloopSmtp0001", name: "LendLoop SMTP", type: "smtp",
    data: { host: e.LENDLOOP_SMTP_HOST, port: Number(e.LENDLOOP_SMTP_PORT), user: e.LENDLOOP_SMTP_USER || "",
            password: e.LENDLOOP_SMTP_PASSWORD || "", secure: false, disableStartTls: e.LENDLOOP_SMTP_HOST === "mailpit" } }]));
' && n8n import:credentials --input=/tmp/lendloop-cred.json >/dev/null 2>&1; status=$?; rm -f /tmp/lendloop-cred.json; exit $status`);
console.log("✔ credential LendLoop SMTP");

for (const { id, file } of WORKFLOWS) {
  n8n(`n8n import:workflow --input=/workflows/${file} >/dev/null 2>&1 && n8n publish:workflow --id=${id} >/dev/null 2>&1`);
  console.log(`✔ imported + published ${file}`);
}

console.log("• restarting n8n to register webhooks and schedules");
docker(["restart", "n8n"]);
for (let i = 0; i < 60; i++) {
  try {
    const res = await fetch("http://localhost:5678/healthz");
    if (res.ok) break;
  } catch {}
  await new Promise((r) => setTimeout(r, 2000));
}
console.log("✔ n8n is up at http://localhost:5678 (create the owner account on first visit)");
console.log("  Mailpit inbox: http://localhost:8025");
