import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  canCancelLoan,
  canDecideLoan,
  canEditTool,
  canMarkReturned,
  canRemoveTool,
  canRequestTool,
  canViewLoan,
} from "./policy";
import { assertValidLoanRange, isIsoDate, rangesOverlap } from "./dates";

const user = (id: string, role: "user" | "admin" = "user") =>
  ({ _id: id as Id<"users">, role, name: id, tokenIdentifier: id, trustedLender: false, _creationTime: 0 }) as Doc<"users">;
const owner = user("owner");
const borrower = user("borrower");
const stranger = user("stranger");
const admin = user("admin", "admin");

const tool = { _id: "t" as Id<"tools">, ownerId: owner._id } as Doc<"tools">;
const loan = (status: Doc<"loans">["status"], startDate = "2026-06-10") =>
  ({ lenderId: owner._id, borrowerId: borrower._id, status, startDate, endDate: "2026-06-12" }) as Doc<"loans">;

const ok = (d: { ok: boolean }) => d.ok;

describe("policy matrix", () => {
  test("tools", () => {
    expect([owner, borrower, stranger, admin].map((u) => ok(canEditTool(u, tool)))).toEqual([true, false, false, false]);
    expect([owner, borrower, stranger, admin].map((u) => ok(canRemoveTool(u, tool)))).toEqual([true, false, false, true]);
    expect([owner, borrower, stranger, admin].map((u) => ok(canRequestTool(u, tool)))).toEqual([false, true, true, true]);
    const removed = { ...tool, removedAt: 1 };
    expect(ok(canEditTool(owner, removed)) || ok(canRemoveTool(admin, removed)) || ok(canRequestTool(borrower, removed))).toBe(false);
  });

  test("loans", () => {
    const people = [owner, borrower, stranger, admin];
    expect(people.map((u) => ok(canViewLoan(u, loan("pending"))))).toEqual([true, true, false, true]);
    expect(people.map((u) => ok(canDecideLoan(u, loan("pending"))))).toEqual([true, false, false, false]);
    expect(people.map((u) => ok(canMarkReturned(u, loan("approved"))))).toEqual([true, false, false, true]);
    expect(people.map((u) => ok(canCancelLoan(u, loan("pending"), "2026-06-01")))).toEqual([false, true, false, false]);
  });

  test("state guards", () => {
    expect(ok(canDecideLoan(owner, loan("approved")))).toBe(false);
    expect(ok(canMarkReturned(owner, loan("pending")))).toBe(false);
    expect(ok(canMarkReturned(owner, loan("returned")))).toBe(false);
    // Borrower can back out of an approved loan only before it starts.
    expect(ok(canCancelLoan(borrower, loan("approved"), "2026-06-09"))).toBe(true);
    expect(ok(canCancelLoan(borrower, loan("approved"), "2026-06-10"))).toBe(false);
  });
});

describe("dates", () => {
  test("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("26-2-1")).toBe(false);
  });
  test("inclusive overlap", () => {
    expect(rangesOverlap("2026-01-01", "2026-01-03", "2026-01-03", "2026-01-05")).toBe(true);
    expect(rangesOverlap("2026-01-01", "2026-01-02", "2026-01-03", "2026-01-05")).toBe(false);
  });
  test("range rules", () => {
    const now = Date.parse("2026-06-01T12:00:00Z");
    expect(() => assertValidLoanRange("2026-06-01", "2026-06-30", now)).not.toThrow();
    expect(() => assertValidLoanRange("2026-06-01", "2026-07-01", now)).toThrow(/at most 30 days/);
    expect(() => assertValidLoanRange("2026-05-31", "2026-06-02", now)).not.toThrow(); // timezone slack
    expect(() => assertValidLoanRange("2026-05-29", "2026-06-02", now)).toThrow(/past/);
  });
});
