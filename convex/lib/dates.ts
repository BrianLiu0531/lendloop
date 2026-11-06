import { LIMITS } from "./validators";
import { invalid } from "./errors";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-31). */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function toIsoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return toIsoDate(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS);
}

/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / DAY_MS);
}

/** Inclusive ranges [aStart, aEnd] and [bStart, bEnd] share at least one day. */
export function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Validates a requested borrow window against server time. One day of slack
 * on "today" covers users west of UTC whose local date is still yesterday.
 */
export function assertValidLoanRange(startDate: string, endDate: string, nowMs: number) {
  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    throw invalid("Dates must be valid calendar dates (YYYY-MM-DD).");
  }
  if (endDate < startDate) throw invalid("The return date must be on or after the start date.");
  const today = toIsoDate(nowMs);
  if (startDate < addDays(today, -1)) throw invalid("The start date can't be in the past.");
  if (daysBetween(today, startDate) > LIMITS.maxDaysAhead) {
    throw invalid(`Requests can be made up to ${LIMITS.maxDaysAhead} days ahead.`);
  }
  if (daysBetween(startDate, endDate) + 1 > LIMITS.maxLoanDays) {
    throw invalid(`A single loan can last at most ${LIMITS.maxLoanDays} days.`);
  }
}
