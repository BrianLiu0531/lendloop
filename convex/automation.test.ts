/**
 * Integration contract with n8n: signature checks in both directions,
 * idempotent write-backs, and outbox retry semantics.
 */
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { hmacHex, inboundBaseString, outboundBaseString } from "./automation/signing";
import { addDays, toIsoDate } from "./lib/dates";
import { ALICE, BOB, setup } from "./test.setup";

const SECRET = "test-inbound-secret";

async function signedFetch(
  t: ReturnType<typeof setup>,
  method: "GET" | "POST",
  pathAndQuery: string,
  body?: unknown,
  opts: { secret?: string; timestamp?: number } = {},
) {
  const raw = body === undefined ? "" : JSON.stringify(body);
  const ts = String(opts.timestamp ?? Math.floor(Date.now() / 1000));
  const sig = await hmacHex(opts.secret ?? SECRET, inboundBaseString(ts, method, pathAndQuery, raw));
  return t.fetch(pathAndQuery, {
    method,
    headers: { "Content-Type": "application/json", "X-LendLoop-Timestamp": ts, "X-LendLoop-Signature": `v1=${sig}` },
    body: raw || undefined,
  });
}

/** Seeds an approved loan that ended `daysAgo` days ago (i.e. overdue). */
async function overdueWorld(daysAgo = 2) {
  const t = setup();
  const alice = t.withIdentity(ALICE);
  const bob = t.withIdentity(BOB);
  await alice.mutation(api.users.ensure, {});
  await bob.mutation(api.users.ensure, {});
  const toolId = await alice.mutation(api.tools.create, {
    name: "Pressure washer",
    category: "cleaning",
    condition: "good",
    description: "",
  });
  const today = toIsoDate(Date.now());
  const loanId = await t.run(async (ctx) => {
    const tool = (await ctx.db.get("tools", toolId))!;
    const borrower = (await ctx.db.query("users").withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", BOB.tokenIdentifier)).unique())!;
    return ctx.db.insert("loans", {
      toolId,
      lenderId: tool.ownerId,
      borrowerId: borrower._id,
      startDate: addDays(today, -daysAgo - 3),
      endDate: addDays(today, -daysAgo),
      status: "approved",
      decidedAt: Date.now(),
    });
  });
  return { t, today, loanId };
}

describe("inbound signature verification (n8n -> Convex)", () => {
  test("rejects missing, wrong-key, stale and path-swapped signatures", async () => {
    const { t, today } = await overdueWorld();
    const path = `/automation/overdue-loans?asOf=${today}`;

    expect((await t.fetch(path, { method: "GET" })).status).toBe(401);
    expect((await signedFetch(t, "GET", path, undefined, { secret: "wrong" })).status).toBe(401);
    const stale = Math.floor(Date.now() / 1000) - 10 * 60;
    expect((await signedFetch(t, "GET", path, undefined, { timestamp: stale })).status).toBe(401);

    // A valid signature for one query string must not work for another.
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = await hmacHex(SECRET, inboundBaseString(ts, "GET", path, ""));
    const swapped = await t.fetch(`/automation/overdue-loans?asOf=${addDays(today, -1)}`, {
      method: "GET",
      headers: { "X-LendLoop-Timestamp": ts, "X-LendLoop-Signature": `v1=${sig}` },
    });
    expect(swapped.status).toBe(401);

    expect((await signedFetch(t, "GET", path)).status).toBe(200);
  });

  test("rejects asOf outside the allowed window and malformed bodies", async () => {
    const { t } = await overdueWorld();
    expect((await signedFetch(t, "GET", "/automation/overdue-loans?asOf=2020-01-01")).status).toBe(400);
    const res = await signedFetch(t, "POST", "/automation/reminders", { loanId: "x", status: "maybe" });
    expect(res.status).toBe(400);
  });
});

describe("overdue sweep + idempotent write-back", () => {
  test("lists overdue loans with only the fields a reminder needs", async () => {
    const { t, today, loanId } = await overdueWorld(2);
    const res = await signedFetch(t, "GET", `/automation/overdue-loans?asOf=${today}`);
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.loans[0]).toEqual({
      loanId,
      idempotencyKey: `${loanId}:${today}`,
      borrower: { name: "Bob", email: "bob@example.com" },
      lender: { name: "Alice" },
      tool: { name: "Pressure washer" },
      endDate: addDays(today, -2),
      daysOverdue: 2,
      url: `https://lendloop.test/me/requests?loan=${loanId}`,
    });
  });

  test("retried write-backs never create duplicate reminders, and 'sent' is never downgraded", async () => {
    const { t, today, loanId } = await overdueWorld();
    const reminder = { loanId, asOf: today, status: "sent", channel: "email", executionId: "exec-1" };

    const first = await (await signedFetch(t, "POST", "/automation/reminders", reminder)).json();
    const retry = await (await signedFetch(t, "POST", "/automation/reminders", reminder)).json();
    const stale = await (
      await signedFetch(t, "POST", "/automation/reminders", { ...reminder, status: "failed", error: "late" })
    ).json();
    expect([first.result, retry.result, stale.result]).toEqual(["created", "duplicate", "duplicate"]);

    const rows = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("sent");

    // Already-reminded loans drop out of today's sweep, so a re-run doesn't re-send.
    const again = await (await signedFetch(t, "GET", `/automation/overdue-loans?asOf=${today}`)).json();
    expect(again.count).toBe(0);
  });

  test("a failed reminder can later succeed (failed -> sent)", async () => {
    const { t, today, loanId } = await overdueWorld();
    const base = { loanId, asOf: today, channel: "email", executionId: "exec-1" };
    await signedFetch(t, "POST", "/automation/reminders", { ...base, status: "failed", error: "SMTP down" });
    const ok = await (await signedFetch(t, "POST", "/automation/reminders", { ...base, status: "sent" })).json();
    expect(ok.result).toBe("updated");
    const [row] = await t.run((ctx) => ctx.db.query("reminders").collect());
    expect(row).toMatchObject({ status: "sent", attempts: 2 });
    expect(row.error).toBeUndefined();
  });

  test("unknown loan ids are rejected", async () => {
    const { t, today } = await overdueWorld();
    const res = await signedFetch(t, "POST", "/automation/reminders", {
      loanId: "notarealid",
      asOf: today,
      status: "sent",
      channel: "email",
      executionId: "e",
    });
    expect(res.status).toBe(404);
  });

  test("run summaries and error-workflow failures are idempotent per execution", async () => {
    const { t, today } = await overdueWorld();
    const run = { executionId: "exec-9", workflow: "overdue-reminders", asOf: today, overdueCount: 1, sent: 1, failed: 0 };
    await signedFetch(t, "POST", "/automation/runs", run);
    await signedFetch(t, "POST", "/automation/runs", run);
    const failure = { executionId: "exec-10", workflow: "loan-notifications", node: "Send email", message: "SMTP timeout" };
    await signedFetch(t, "POST", "/automation/failures", failure);
    await signedFetch(t, "POST", "/automation/failures", failure);
    const [runs, failures] = await t.run(async (ctx) => [
      await ctx.db.query("automationRuns").collect(),
      await ctx.db.query("automationFailures").collect(),
    ]);
    expect(runs).toHaveLength(1);
    expect(failures).toHaveLength(1);
  });
});

describe("outbound delivery (Convex -> n8n)", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function eventWorld() {
    const t = setup();
    const alice = t.withIdentity(ALICE);
    const bob = t.withIdentity(BOB);
    await alice.mutation(api.users.ensure, {});
    await bob.mutation(api.users.ensure, {});
    const toolId = await alice.mutation(api.tools.create, { name: "Tent", category: "camping", condition: "good", description: "4-person" });
    const today = toIsoDate(Date.now());
    await bob.mutation(api.loans.request, { toolId, startDate: addDays(today, 1), endDate: addDays(today, 2), message: "Private note" });
    const outboxId = await t.run(async (ctx) => (await ctx.db.query("outbox").first())!._id);
    return { t, outboxId: outboxId as Id<"outbox"> };
  }

  test("signs the payload, sends minimal data, and marks delivered", async () => {
    const calls: { headers: Headers; body: string }[] = [];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      calls.push({ headers: new Headers(init.headers), body: String(init.body) });
      return new Response("ok", { status: 200 });
    });
    const { t, outboxId } = await eventWorld();
    await t.action(internal.automation.delivery.deliver, { outboxId });

    expect(calls).toHaveLength(1);
    const { headers, body } = calls[0];
    const ts = headers.get("X-LendLoop-Timestamp")!;
    const expected = await hmacHex("test-outbound-secret", outboundBaseString(ts, body));
    expect(headers.get("X-LendLoop-Signature")).toBe(`v1=${expected}`);

    const payload = JSON.parse(body);
    expect(payload).toMatchObject({
      type: "loan.requested",
      recipient: { role: "lender", name: "Alice", email: "alice@example.com" },
      counterpart: { name: "Bob" },
      tool: { name: "Tent" },
    });
    // Data minimization: no free text, descriptions or counterpart contact details.
    expect(body).not.toContain("Private note");
    expect(body).not.toContain("4-person");
    expect(body).not.toContain("bob@example.com");

    const event = await t.run((ctx) => ctx.db.get("outbox", outboxId));
    expect(event).toMatchObject({ status: "delivered", attempts: 1 });
  });

  test("5xx is retried with backoff; a 4xx rejection is dead immediately", async () => {
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 503 }));
    const { t, outboxId } = await eventWorld();
    await t.action(internal.automation.delivery.deliver, { outboxId });
    expect(await t.run((ctx) => ctx.db.get("outbox", outboxId))).toMatchObject({ status: "retrying", attempts: 1 });

    vi.stubGlobal("fetch", async () => new Response("bad signature", { status: 401 }));
    await t.action(internal.automation.delivery.deliver, { outboxId });
    const dead = await t.run((ctx) => ctx.db.get("outbox", outboxId));
    expect(dead).toMatchObject({ status: "dead", attempts: 2 });
    expect(dead?.lastError).toContain("401");
  });

  test("gives up after MAX_ATTEMPTS and stops calling n8n", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls++;
      throw new TypeError("fetch failed");
    });
    const { t, outboxId } = await eventWorld();
    for (let i = 0; i < 8; i++) await t.action(internal.automation.delivery.deliver, { outboxId });
    expect(calls).toBe(6);
    expect(await t.run((ctx) => ctx.db.get("outbox", outboxId))).toMatchObject({ status: "dead", attempts: 6 });
  });
});
