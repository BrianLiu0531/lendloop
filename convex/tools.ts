import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { audit } from "./lib/audit";
import { approvedLoansForTool, computeAvailability } from "./lib/availability";
import { isIsoDate } from "./lib/dates";
import { invalid, notFound } from "./lib/errors";
import { publicQuery, userMutation, userQuery } from "./lib/functions";
import { canEditTool, canRemoveTool, enforce } from "./lib/policy";
import { rateLimiter } from "./lib/rateLimits";
import { LIMITS, vCategory, vCondition } from "./lib/validators";
import { publishLoanEvent } from "./lib/outbox";
import { publicName } from "./lib/privacy";
import { attachPhotos, coverUrl, deletePhotos, photoItems, photoUrls } from "./photos";

const MAX_LIST = 200;

function activeTools(ctx: QueryCtx, category?: Doc<"tools">["category"]) {
  return category
    ? ctx.db
        .query("tools")
        .withIndex("by_removedAt_and_category", (q) => q.eq("removedAt", undefined).eq("category", category))
    : ctx.db.query("tools").withIndex("by_removedAt", (q) => q.eq("removedAt", undefined));
}

function cleanFields(input: { name: string; description: string }) {
  const name = input.name.trim().replace(/\s+/g, " ");
  const description = input.description.trim();
  if (name.length < LIMITS.toolName.min || name.length > LIMITS.toolName.max) {
    throw invalid(`Name must be ${LIMITS.toolName.min}–${LIMITS.toolName.max} characters.`);
  }
  if (description.length > LIMITS.description.max) {
    throw invalid(`Description must be at most ${LIMITS.description.max} characters.`);
  }
  return { name, description };
}

/**
 * Landing page feed. Deliberately returns ONLY name + category: no ids, no
 * owner, no description, no availability — nothing that identifies a
 * household to an anonymous visitor.
 */
export const listPublic = publicQuery({
  args: {},
  returns: v.array(v.object({ name: v.string(), category: vCategory })),
  handler: async (ctx) => {
    const tools = await activeTools(ctx).order("desc").take(48);
    return tools.map((t) => ({ name: t.name, category: t.category }));
  },
});

/** The signed-in board: every active tool with derived availability. */
export const list = userQuery({
  args: { category: v.optional(vCategory), today: v.string() },
  handler: async (ctx, { category, today }) => {
    if (!isIsoDate(today)) throw invalid("Invalid date.");
    const tools = await activeTools(ctx, category).order("desc").take(MAX_LIST);
    return await Promise.all(
      tools.map(async (tool) => {
        const [owner, approved, myPending] = await Promise.all([
          ctx.db.get("users", tool.ownerId),
          approvedLoansForTool(ctx, tool._id),
          ctx.db
            .query("loans")
            .withIndex("by_toolId_and_status", (q) => q.eq("toolId", tool._id).eq("status", "pending"))
            .filter((q) => q.eq(q.field("borrowerId"), ctx.viewer._id))
            .first(),
        ]);
        return {
          _id: tool._id,
          name: tool.name,
          category: tool.category,
          condition: tool.condition,
          description: tool.description,
          isMine: tool.ownerId === ctx.viewer._id,
          owner: { name: publicName(owner), trustedLender: owner?.trustedLender ?? false },
          availability: computeAvailability(approved, today),
          iHaveRequested: myPending !== null,
          coverUrl: await coverUrl(ctx, tool.photos),
        };
      }),
    );
  },
});

/** Tool detail page, including booked windows (dates only — never who booked them). */
export const get = userQuery({
  // Accepts a raw string from the URL; malformed ids resolve to "not found" instead of throwing.
  args: { toolId: v.string(), today: v.string() },
  handler: async (ctx, { toolId: rawId, today }) => {
    const toolId = ctx.db.normalizeId("tools", rawId);
    const tool = toolId ? await ctx.db.get("tools", toolId) : null;
    if (!tool || (tool.removedAt !== undefined && tool.ownerId !== ctx.viewer._id)) return null;
    const [owner, approved] = await Promise.all([
      ctx.db.get("users", tool.ownerId),
      approvedLoansForTool(ctx, tool._id),
    ]);
    const myLoans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", ctx.viewer._id))
      .filter((q) => q.eq(q.field("toolId"), tool._id))
      .order("desc")
      .take(10);
    return {
      _id: tool._id,
      name: tool.name,
      category: tool.category,
      condition: tool.condition,
      description: tool.description,
      removed: tool.removedAt !== undefined,
      photos: await photoUrls(ctx, tool.photos),
      isMine: tool.ownerId === ctx.viewer._id,
      owner: { name: publicName(owner), trustedLender: owner?.trustedLender ?? false },
      availability: computeAvailability(approved, today),
      booked: approved.map((l) => ({ startDate: l.startDate, endDate: l.endDate })),
      myLoans: myLoans.map((l) => ({
        _id: l._id,
        status: l.status,
        startDate: l.startDate,
        endDate: l.endDate,
      })),
    };
  },
});

/** "My listings", with how many requests are waiting on each. */
export const mine = userQuery({
  args: { today: v.string() },
  handler: async (ctx, { today }) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", ctx.viewer._id))
      .order("desc")
      .take(MAX_LIST);
    return await Promise.all(
      tools
        .filter((t) => t.removedAt === undefined)
        .map(async (tool) => {
          const [approved, pending] = await Promise.all([
            approvedLoansForTool(ctx, tool._id),
            ctx.db
              .query("loans")
              .withIndex("by_toolId_and_status", (q) => q.eq("toolId", tool._id).eq("status", "pending"))
              .take(50),
          ]);
          return {
            _id: tool._id,
            name: tool.name,
            category: tool.category,
            condition: tool.condition,
            description: tool.description,
            availability: computeAvailability(approved, today),
            pendingRequests: pending.length,
            photos: await photoItems(ctx, tool.photos),
          };
        }),
    );
  },
});

const toolFields = {
  name: v.string(),
  category: vCategory,
  condition: vCondition,
  description: v.string(),
  /** Uploaded via photos.generateUploadUrl + registerUpload; cover first. */
  photos: v.optional(v.array(v.id("_storage"))),
};

export const create = userMutation({
  args: toolFields,
  returns: v.id("tools"),
  handler: async (ctx, args) => {
    await rateLimiter.limit(ctx, "createTool", { key: ctx.viewer._id, throws: true });
    const { name, description } = cleanFields(args);
    const photos = await attachPhotos(ctx, ctx.viewer, args.photos ?? []);
    // ownerId comes from the verified identity, never from the client.
    return await ctx.db.insert("tools", {
      ownerId: ctx.viewer._id,
      name,
      description,
      category: args.category,
      condition: args.condition,
      photos,
    });
  },
});

export const update = userMutation({
  args: { toolId: v.id("tools"), ...toolFields },
  returns: v.null(),
  handler: async (ctx, { toolId, ...fields }) => {
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw notFound("Listing");
    enforce(canEditTool(ctx.viewer, tool));
    const { name, description } = cleanFields(fields);
    // Omitting `photos` leaves them untouched; passing a list replaces them.
    const photos =
      fields.photos === undefined ? tool.photos : await attachPhotos(ctx, ctx.viewer, fields.photos, tool.photos);
    await ctx.db.patch("tools", toolId, {
      name,
      description,
      category: fields.category,
      condition: fields.condition,
      photos,
    });
    return null;
  },
});

/**
 * Owners delete their own listings; admins can remove anyone's (moderation).
 * Soft delete: history stays intact for both parties. Open requests and
 * future bookings are closed and those borrowers are notified.
 */
export const remove = userMutation({
  args: { toolId: v.id("tools"), reason: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { toolId, reason }) => {
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) throw notFound("Listing");
    enforce(canRemoveTool(ctx.viewer, tool));
    const asAdmin = tool.ownerId !== ctx.viewer._id;
    const cleanReason = reason?.trim().slice(0, 200) || undefined;

    // Photos are deleted outright: a removed listing keeps its name for loan
    // history, but nothing else needs to linger.
    await deletePhotos(ctx, tool.photos);
    await ctx.db.patch("tools", toolId, {
      removedAt: Date.now(),
      removedBy: ctx.viewer._id,
      removalReason: cleanReason,
      photos: [],
    });
    await closeOpenLoans(ctx, tool, asAdmin ? "Listing removed by a moderator" : "Listing removed by its owner");

    if (asAdmin) {
      await audit(ctx, ctx.viewer, "tool.removed", { type: "tools", id: toolId }, cleanReason ?? tool.name);
    }
    return null;
  },
});

async function closeOpenLoans(ctx: MutationCtx, tool: Doc<"tools">, closedReason: string) {
  const today = new Date().toISOString().slice(0, 10);
  for (const status of ["pending", "approved"] as const) {
    const loans = await ctx.db
      .query("loans")
      .withIndex("by_toolId_and_status", (q) => q.eq("toolId", tool._id).eq("status", status))
      .take(100);
    for (const loan of loans) {
      // A loan already in progress keeps running so the lender can still
      // mark it returned; only requests and future bookings are closed.
      if (status === "approved" && loan.startDate <= today) continue;
      const next = status === "pending" ? ("declined" as const) : ("cancelled" as const);
      await ctx.db.patch("loans", loan._id, { status: next, decidedAt: Date.now(), closedReason });
      // The borrower is the one who needs to know their booking is gone.
      await publishLoanEvent(
        ctx,
        next === "declined" ? "loan.declined" : "loan.cancelled",
        { ...loan, status: next },
        "borrower",
      );
    }
  }
}
