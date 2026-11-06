/**
 * Role-based access control, exercised through the real public API as
 * different signed-in identities. These are the guarantees the UI relies on
 * but does not enforce.
 */
import { describe, expect, test } from "vitest";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ADMIN, ALICE, BOB, CAROL, setup } from "./test.setup";
import { addDays, toIsoDate } from "./lib/dates";

const today = toIsoDate(Date.now());
const tool = { name: "Cordless drill", category: "power_tools", condition: "good", description: "18V, two batteries" } as const;

async function world() {
  const t = setup();
  const alice = t.withIdentity(ALICE);
  const bob = t.withIdentity(BOB);
  const carol = t.withIdentity(CAROL);
  const admin = t.withIdentity(ADMIN);
  for (const u of [alice, bob, carol, admin]) await u.mutation(api.users.ensure, {});
  const toolId = await alice.mutation(api.tools.create, tool);
  return { t, alice, bob, carol, admin, toolId };
}

function rejects(p: Promise<unknown>, code: string) {
  return expect(p).rejects.toMatchObject({ data: { code } });
}

describe("public data exposure", () => {
  test("landing page list exposes only name and category", async () => {
    const { t } = await world();
    const list = await t.query(api.tools.listPublic, {});
    expect(list).toEqual([{ name: "Cordless drill", category: "power_tools" }]);
  });

  test("signed-out callers can't use authenticated functions", async () => {
    const { t, toolId } = await world();
    await rejects(t.mutation(api.tools.create, tool), "UNAUTHENTICATED");
    await rejects(t.query(api.tools.list, { today }), "UNAUTHENTICATED");
    await rejects(
      t.mutation(api.loans.request, { toolId, startDate: today, endDate: today }),
      "UNAUTHENTICATED",
    );
  });

  test("board shows owner first name only", async () => {
    const { bob } = await world();
    const [row] = await bob.query(api.tools.list, { today });
    expect(row.owner).toEqual({ name: "Alice", trustedLender: false });
    expect(JSON.stringify(row)).not.toContain("alice@example.com");
  });
});

describe("listings", () => {
  test("only the owner can edit; admins can't edit content", async () => {
    const { alice, bob, admin, toolId } = await world();
    await alice.mutation(api.tools.update, { toolId, ...tool, name: "Drill (18V)" });
    await rejects(bob.mutation(api.tools.update, { toolId, ...tool, name: "Mine now" }), "FORBIDDEN");
    await rejects(admin.mutation(api.tools.update, { toolId, ...tool, name: "Edited" }), "FORBIDDEN");
  });

  test("other users can't delete; admins can remove any listing (audited)", async () => {
    const { t, bob, admin, toolId } = await world();
    await rejects(bob.mutation(api.tools.remove, { toolId }), "FORBIDDEN");
    await admin.mutation(api.tools.remove, { toolId, reason: "Spam" });
    expect(await t.query(api.tools.listPublic, {})).toEqual([]);
    const log = await admin.query(api.admin.auditLog, {});
    expect(log[0]).toMatchObject({ action: "tool.removed", detail: "Spam" });
  });

  test("input is validated server-side", async () => {
    const { alice } = await world();
    await rejects(alice.mutation(api.tools.create, { ...tool, name: " " }), "INVALID");
    await rejects(alice.mutation(api.tools.create, { ...tool, description: "x".repeat(501) }), "INVALID");
  });
});

describe("loans", () => {
  async function requested() {
    const w = await world();
    const loanId = await w.bob.mutation(api.loans.request, {
      toolId: w.toolId,
      startDate: addDays(today, 1),
      endDate: addDays(today, 3),
    });
    return { ...w, loanId };
  }

  test("you can't borrow your own tool", async () => {
    const { alice, toolId } = await world();
    await rejects(alice.mutation(api.loans.request, { toolId, startDate: today, endDate: today }), "FORBIDDEN");
  });

  test("only the lender can approve or decline", async () => {
    const { alice, bob, carol, admin, loanId } = await requested();
    await rejects(bob.mutation(api.loans.approve, { loanId }), "FORBIDDEN");
    await rejects(carol.mutation(api.loans.approve, { loanId }), "FORBIDDEN");
    await rejects(admin.mutation(api.loans.approve, { loanId }), "FORBIDDEN");
    await rejects(carol.mutation(api.loans.decline, { loanId }), "FORBIDDEN");
    await alice.mutation(api.loans.approve, { loanId });
    await rejects(alice.mutation(api.loans.approve, { loanId }), "FORBIDDEN"); // already decided
  });

  test("only the borrower can cancel; only lender or admin can mark returned", async () => {
    const { alice, bob, carol, admin, loanId } = await requested();
    await rejects(alice.mutation(api.loans.cancel, { loanId }), "FORBIDDEN");
    await alice.mutation(api.loans.approve, { loanId });
    await rejects(bob.mutation(api.loans.markReturned, { loanId }), "FORBIDDEN");
    await rejects(carol.mutation(api.loans.markReturned, { loanId }), "FORBIDDEN");
    await admin.mutation(api.loans.markReturned, { loanId });
  });

  test("contact emails are exchanged only while a loan is approved", async () => {
    const { alice, bob, loanId } = await requested();
    const emailOf = async () => (await bob.query(api.loans.myRequests, { today }))[0].counterpart.email;
    expect(await emailOf()).toBeNull(); // pending: no contact yet
    await alice.mutation(api.loans.approve, { loanId });
    expect(await emailOf()).toBe("alice@example.com");
    expect((await alice.query(api.loans.incoming, { today }))[0].counterpart.email).toBe("bob@example.com");
    await alice.mutation(api.loans.markReturned, { loanId });
    expect(await emailOf()).toBeNull(); // closed: hidden again
  });

  test("loan timelines are visible only to participants and admins", async () => {
    const { bob, carol, admin, loanId } = await requested();
    await bob.query(api.loans.timeline, { loanId });
    await admin.query(api.loans.timeline, { loanId });
    await rejects(carol.query(api.loans.timeline, { loanId }), "FORBIDDEN");
  });

  test("approving auto-declines overlapping requests and blocks double booking", async () => {
    const { t, alice, carol, toolId, loanId } = await requested();
    const clash = await carol.mutation(api.loans.request, {
      toolId,
      startDate: addDays(today, 2),
      endDate: addDays(today, 5),
    });
    await alice.mutation(api.loans.approve, { loanId });
    const clashed = await t.run((ctx) => ctx.db.get("loans", clash));
    expect(clashed).toMatchObject({ status: "declined", closedReason: expect.stringContaining("booked") });
    await expect(
      carol.mutation(api.loans.request, { toolId, startDate: addDays(today, 3), endDate: addDays(today, 4) }),
    ).rejects.toMatchObject({ data: { code: "CONFLICT" } });
  });

  test("every state change writes exactly one outbox event for the right recipient", async () => {
    const { t, alice, loanId } = await requested();
    await alice.mutation(api.loans.approve, { loanId });
    const events = await t.run((ctx) =>
      ctx.db.query("outbox").withIndex("by_loanId", (q) => q.eq("loanId", loanId as Id<"loans">)).collect(),
    );
    expect(events.map((e) => [e.type, e.recipientRole])).toEqual([
      ["loan.requested", "lender"],
      ["loan.approved", "borrower"],
    ]);
  });

  test("date ranges are validated", async () => {
    const { bob, toolId } = await world();
    await rejects(bob.mutation(api.loans.request, { toolId, startDate: addDays(today, 3), endDate: addDays(today, 1) }), "INVALID");
    await rejects(bob.mutation(api.loans.request, { toolId, startDate: addDays(today, -5), endDate: today }), "INVALID");
    await rejects(bob.mutation(api.loans.request, { toolId, startDate: today, endDate: addDays(today, 40) }), "INVALID");
    await rejects(bob.mutation(api.loans.request, { toolId, startDate: "2026-02-31", endDate: "2026-03-01" }), "INVALID");
  });
});

describe("admin", () => {
  test("admin role is bootstrapped only for verified allow-listed emails", async () => {
    const t = setup();
    const unverified = t.withIdentity({ ...ADMIN, tokenIdentifier: "clerk|imposter", emailVerified: false });
    await unverified.mutation(api.users.ensure, {});
    expect((await unverified.query(api.users.me, {}))?.role).toBe("user");
    const real = t.withIdentity(ADMIN);
    await real.mutation(api.users.ensure, {});
    expect((await real.query(api.users.me, {}))?.role).toBe("admin");
  });

  test("admin-only functions reject regular users", async () => {
    const { bob, admin } = await world();
    const me = await admin.query(api.users.me, {});
    await rejects(bob.query(api.admin.members, {}), "FORBIDDEN");
    await rejects(bob.query(api.admin.loans, { today }), "FORBIDDEN");
    await rejects(bob.mutation(api.admin.setTrustedLender, { userId: me!._id, trusted: true }), "FORBIDDEN");
  });

  test("admin can mark a Trusted Lender, which shows on their listings", async () => {
    const { alice, bob, admin } = await world();
    const aliceId = (await alice.query(api.users.me, {}))!._id;
    await admin.mutation(api.admin.setTrustedLender, { userId: aliceId, trusted: true });
    const [row] = await bob.query(api.tools.list, { today });
    expect(row.owner.trustedLender).toBe(true);
  });

  test("admins can't change their own role", async () => {
    const { admin } = await world();
    const me = (await admin.query(api.users.me, {}))!;
    await rejects(admin.mutation(api.admin.setRole, { userId: me._id, role: "user" }), "CONFLICT");
  });
});
