#!/usr/bin/env node
/**
 * Gives the seeded demo listings real photos (openly licensed; credits in
 * docs/photo-credits.md). Run after `npm run seed`:
 *
 *   node scripts/seed-photos.mjs          # current deployment
 *   node scripts/seed-photos.mjs --prod   # production
 *
 * Uses internal Convex functions through the CLI, so no client can call them.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "scripts", "seed-photos");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const prod = process.argv.includes("--prod") ? ["--prod"] : [];
const cli = join(root, "node_modules", "convex", "bin", "main.js");

function run(fn, args) {
  const out = execFileSync(process.execPath, [cli, "run", ...prod, fn, JSON.stringify(args)], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const text = out.trim();
  return text ? JSON.parse(text) : null; // functions returning null print nothing
}

for (const item of manifest) {
  const toolIds = run("seed:toolsNamed", { toolName: item.item });
  if (toolIds.length === 0) {
    console.log(`- ${item.item}: no listing, skipped`);
    continue;
  }
  const bytes = readFileSync(join(dir, item.file));
  for (const toolId of toolIds) {
    const url = run("seed:photoUploadUrl", {});
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": item.contentType }, body: bytes });
    if (!res.ok) throw new Error(`Upload failed for ${item.item}: ${res.status}`);
    const { storageId } = await res.json();
    run("seed:setToolPhoto", { toolId, storageId });
  }
  console.log(`✓ ${item.item} (${toolIds.length})`);
}
