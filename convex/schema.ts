import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import {
  vCategory,
  vCondition,
  vDeliveryStatus,
  vLoanEventType,
  vLoanStatus,
  vRecipientRole,
  vRole,
} from "./lib/validators";

export default defineSchema({
  /**
   * One row per Clerk identity. `role` lives here (server-owned), not in a
   * client-editable Clerk field, so it can only change through an admin
   * mutation that is audited.
   */
  users: defineTable({
    tokenIdentifier: v.string(),
    name: v.string(),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    role: vRole,
    trustedLender: v.boolean(),
  })
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_role", ["role"]),

  tools: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: vCategory,
    condition: vCondition,
    description: v.string(),
    /** File-storage ids, cover first. Only signed-in users can see them. */
    photos: v.optional(v.array(v.id("_storage"))),
    /** Soft delete keeps loan history intact; removed tools are never listed. */
    removedAt: v.optional(v.number()),
    removedBy: v.optional(v.id("users")),
    removalReason: v.optional(v.string()),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_removedAt", ["removedAt"])
    .index("by_removedAt_and_category", ["removedAt", "category"]),

  /**
   * Who uploaded each not-yet-attached photo. A listing may only attach
   * uploads made by its owner; rows are deleted once attached, and stale
   * ones (abandoned forms) are garbage-collected with their files.
   */
  photoUploads: defineTable({
    storageId: v.id("_storage"),
    userId: v.id("users"),
  }).index("by_storageId", ["storageId"]),

  loans: defineTable({
    toolId: v.id("tools"),
    lenderId: v.id("users"),
    borrowerId: v.id("users"),
    /** Inclusive ISO calendar dates (YYYY-MM-DD). */
    startDate: v.string(),
    endDate: v.string(),
    message: v.optional(v.string()),
    status: vLoanStatus,
    decidedAt: v.optional(v.number()),
    returnedAt: v.optional(v.number()),
    /** Set when the loan was closed automatically (e.g. tool removed, conflict). */
    closedReason: v.optional(v.string()),
  })
    .index("by_toolId_and_status", ["toolId", "status"])
    .index("by_borrowerId", ["borrowerId"])
    .index("by_lenderId", ["lenderId"])
    .index("by_status_and_endDate", ["status", "endDate"]),

  /**
   * Transactional outbox for Convex -> n8n webhooks. A row is written in the
   * same transaction as the state change, then a scheduled action delivers
   * it with retries. `eventId` doubles as the idempotency key n8n dedupes on.
   */
  outbox: defineTable({
    eventId: v.string(),
    type: vLoanEventType,
    loanId: v.id("loans"),
    recipientId: v.id("users"),
    recipientRole: vRecipientRole,
    status: vDeliveryStatus,
    attempts: v.number(),
    lastError: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  })
    .index("by_eventId", ["eventId"])
    .index("by_loanId", ["loanId"])
    .index("by_status", ["status"]),

  /**
   * Overdue reminders written back by n8n. `idempotencyKey` is
   * `<loanId>:<asOf>` so a retried or re-run workflow can never create a
   * second reminder for the same loan on the same day.
   */
  reminders: defineTable({
    idempotencyKey: v.string(),
    loanId: v.id("loans"),
    asOf: v.string(),
    status: v.union(v.literal("sent"), v.literal("failed")),
    channel: v.string(),
    executionId: v.string(),
    error: v.optional(v.string()),
    attempts: v.number(),
    updatedAt: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_loanId", ["loanId"]),

  /** One row per scheduled overdue sweep, so a scheduler that stops running is noticed. */
  automationRuns: defineTable({
    executionId: v.string(),
    workflow: v.string(),
    asOf: v.string(),
    overdueCount: v.number(),
    sent: v.number(),
    failed: v.number(),
    finishedAt: v.number(),
  })
    .index("by_executionId", ["executionId"])
    .index("by_workflow", ["workflow"]),

  /** Failures reported by the n8n error workflow (idempotent on executionId). */
  automationFailures: defineTable({
    executionId: v.string(),
    workflow: v.string(),
    node: v.optional(v.string()),
    message: v.string(),
    executionUrl: v.optional(v.string()),
    occurredAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
    acknowledgedBy: v.optional(v.id("users")),
  })
    .index("by_executionId", ["executionId"])
    .index("by_acknowledgedAt", ["acknowledgedAt"]),

  /** Append-only record of privileged actions. */
  auditLog: defineTable({
    actorId: v.optional(v.id("users")),
    actor: v.string(),
    action: v.string(),
    targetType: v.string(),
    targetId: v.string(),
    detail: v.optional(v.string()),
  }).index("by_targetId", ["targetId"]),
});
