import { v, type Infer } from "convex/values";

export const CATEGORIES = [
  "power_tools",
  "hand_tools",
  "garden",
  "kitchen",
  "camping",
  "cleaning",
  "ladders",
  "sports",
  "kids",
  "other",
] as const;

export const CONDITIONS = ["like_new", "good", "fair", "well_used"] as const;

export const vCategory = v.union(...CATEGORIES.map((c) => v.literal(c)));
export const vCondition = v.union(...CONDITIONS.map((c) => v.literal(c)));
export const vRole = v.union(v.literal("user"), v.literal("admin"));

/**
 * Loan lifecycle:
 *
 *   pending ──approve──▶ approved ──markReturned──▶ returned
 *      │                    │
 *      ├──decline──▶ declined
 *      └──cancel───▶ cancelled ◀──cancel (borrower, before start)
 *
 * "Overdue" and "on loan" are derived from `approved` + dates, never stored,
 * so they can't drift from the truth.
 */
export const vLoanStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("declined"),
  v.literal("cancelled"),
  v.literal("returned"),
);

/** Events Convex publishes to n8n. Names are part of the integration contract. */
export const vLoanEventType = v.union(
  v.literal("loan.requested"),
  v.literal("loan.approved"),
  v.literal("loan.declined"),
  v.literal("loan.cancelled"),
  v.literal("loan.returned"),
);

export const vRecipientRole = v.union(v.literal("lender"), v.literal("borrower"));

export const vDeliveryStatus = v.union(
  v.literal("queued"),
  v.literal("delivered"),
  v.literal("retrying"),
  v.literal("dead"),
);

export type Category = Infer<typeof vCategory>;
export type Condition = Infer<typeof vCondition>;
export type Role = Infer<typeof vRole>;
export type LoanStatus = Infer<typeof vLoanStatus>;
export type LoanEventType = Infer<typeof vLoanEventType>;
export type RecipientRole = Infer<typeof vRecipientRole>;

export const LIMITS = {
  toolName: { min: 2, max: 80 },
  description: { max: 500 },
  requestMessage: { max: 300 },
  maxLoanDays: 30,
  maxDaysAhead: 90,
} as const;
