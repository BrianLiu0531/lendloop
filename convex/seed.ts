/**
 * Demo data. Internal-only (not callable from the browser):
 *
 *   npx convex run seed:run                            # neighbors, tools, loans
 *   npx convex run seed:involve '{"email":"you@x.com"}' # wire YOUR account into the story
 *
 * Seeded neighbors use @example.com addresses, so any notification they
 * trigger lands in Mailpit locally and nowhere real.
 */
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { addDays, toIsoDate } from "./lib/dates";
import { publishLoanEvent } from "./lib/outbox";
import type { Category, Condition } from "./lib/validators";

const NEIGHBORS = [
  { key: "maya", name: "Maya Chen", trusted: true },
  { key: "omar", name: "Omar Haddad", trusted: false },
  { key: "lena", name: "Lena Novak", trusted: true },
  { key: "sam", name: "Sam Okafor", trusted: false },
  { key: "ruth", name: "Ruth Alvarez", trusted: false },
] as const;
type Key = (typeof NEIGHBORS)[number]["key"];

const TOOLS: { owner: Key; name: string; category: Category; condition: Condition; description: string }[] = [
  { owner: "maya", name: "Cordless drill (18V)", category: "power_tools", condition: "good", description: "Two batteries, charger and a full bit set. The left battery holds a little less charge." },
  { owner: "maya", name: "Extension ladder, 6 m", category: "ladders", condition: "good", description: "Aluminium, rated 150 kg. You'll need a car with roof racks or a friend." },
  { owner: "omar", name: "Pressure washer", category: "cleaning", condition: "like_new", description: "Great for decks and patios. Comes with the patio-cleaner attachment." },
  { owner: "omar", name: "Stand mixer", category: "kitchen", condition: "fair", description: "Dough hook, whisk and paddle. Bowl has a small dent; works perfectly." },
  { owner: "lena", name: "4-person tent", category: "camping", condition: "good", description: "Pitches in ten minutes. Includes footprint and spare pegs." },
  { owner: "lena", name: "Camping stove + 2 pans", category: "camping", condition: "well_used", description: "Takes standard screw-on gas canisters (not included)." },
  { owner: "lena", name: "Hedge trimmer", category: "garden", condition: "good", description: "Electric, 20 m extension cable included." },
  { owner: "sam", name: "Tile cutter", category: "hand_tools", condition: "good", description: "Manual, up to 60 cm tiles." },
  { owner: "sam", name: "Kids' bike trailer", category: "kids", condition: "like_new", description: "Seats two, fits most bikes. Rain cover included." },
  { owner: "ruth", name: "Lawn aerator", category: "garden", condition: "fair", description: "Spike aerator — best after a bit of rain." },
  { owner: "ruth", name: "Stud finder", category: "hand_tools", condition: "like_new", description: "" },
  { owner: "ruth", name: "Paddle board + pump", category: "sports", condition: "good", description: "Inflatable SUP, paddle, leash and electric pump." },
];

async function upsertNeighbor(ctx: MutationCtx, n: (typeof NEIGHBORS)[number]) {
  const tokenIdentifier = `seed|${n.key}`;
  const existing = await ctx.db
    .query("users")
    .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", tokenIdentifier))
    .unique();
  if (existing) return existing._id;
  return await ctx.db.insert("users", {
    tokenIdentifier,
    name: n.name,
    email: `${n.key}@example.com`,
    role: "user",
    trustedLender: n.trusted,
  });
}

export const run = internalMutation({
  args: {},
  handler: async (ctx) => {
    if (await ctx.db.query("tools").first()) return "Already seeded — skipping.";
    const ids = {} as Record<Key, Id<"users">>;
    for (const n of NEIGHBORS) ids[n.key] = await upsertNeighbor(ctx, n);

    const toolIds: Id<"tools">[] = [];
    for (const t of TOOLS) {
      toolIds.push(
        await ctx.db.insert("tools", {
          ownerId: ids[t.owner],
          name: t.name,
          category: t.category,
          condition: t.condition,
          description: t.description,
        }),
      );
    }

    // Loans between neighbors (inserted directly: seeding shouldn't fire notifications).
    const today = toIsoDate(Date.now());
    const loan = (tool: number, borrower: Key, start: number, end: number, status: "approved" | "pending" | "returned") =>
      ctx.db.insert("loans", {
        toolId: toolIds[tool],
        lenderId: ids[TOOLS[tool].owner],
        borrowerId: ids[borrower],
        startDate: addDays(today, start),
        endDate: addDays(today, end),
        status,
        decidedAt: status === "pending" ? undefined : Date.now(),
        returnedAt: status === "returned" ? Date.now() : undefined,
      });
    await loan(1, "sam", -1, 2, "approved"); // ladder on loan
    await loan(4, "omar", 5, 8, "approved"); // tent booked next week
    await loan(2, "ruth", -6, -2, "approved"); // pressure washer OVERDUE
    await loan(6, "maya", 2, 3, "pending");
    await loan(0, "lena", -20, -18, "returned");
    return `Seeded ${NEIGHBORS.length} neighbors, ${TOOLS.length} tools, 5 loans.`;
  },
});

/**
 * Puts a real signed-in account into the story. Idempotent: run it again any
 * time and it only adds what's missing.
 *  - lending: a Circular saw with a pending request from Omar (with a note)
 *  - lending: a Socket set currently out with Lena (contact details shown)
 *  - borrowing: Maya's drill, two days overdue
 * Request and approval go through the outbox, so n8n sends the emails and
 * each loan shows real automation activity.
 */
export const involve = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const me = (await ctx.db.query("users").take(500)).find((u) => u.email === email.toLowerCase());
    if (!me) throw new Error(`No user with email ${email} — sign in to the app once first.`);
    const maya = await upsertNeighbor(ctx, NEIGHBORS[0]);
    const omar = await upsertNeighbor(ctx, NEIGHBORS[1]);
    const lena = await upsertNeighbor(ctx, NEIGHBORS[2]);
    const today = toIsoDate(Date.now());
    const added: string[] = [];

    const myTools = await ctx.db.query("tools").withIndex("by_ownerId", (q) => q.eq("ownerId", me._id)).take(50);
    async function myTool(name: string, category: Category, condition: Condition, description: string) {
      const found = myTools.find((t) => t.name === name && !t.removedAt);
      if (found) return { id: found._id, fresh: false };
      const id = await ctx.db.insert("tools", { ownerId: me!._id, name, category, condition, description });
      return { id, fresh: true };
    }

    const saw = await myTool("Circular saw", "power_tools", "good", "7¼\" blade, with a spare blade and the rip fence.");
    if (saw.fresh) {
      const loanId = await ctx.db.insert("loans", {
        toolId: saw.id,
        lenderId: me._id,
        borrowerId: omar,
        startDate: addDays(today, 2),
        endDate: addDays(today, 4),
        message: "Building a raised garden bed this weekend — happy to drop it back Monday morning!",
        status: "pending",
      });
      await publishLoanEvent(ctx, "loan.requested", (await ctx.db.get("loans", loanId))!);
      added.push("an incoming request");
    }

    const sockets = await myTool("Socket set (72 pc)", "hand_tools", "like_new", "Metric and imperial, ¼\" and ⅜\" drive, in a carry case.");
    if (sockets.fresh) {
      const loanId = await ctx.db.insert("loans", {
        toolId: sockets.id,
        lenderId: me._id,
        borrowerId: lena,
        startDate: addDays(today, -1),
        endDate: addDays(today, 3),
        message: "Bike service day — thank you!",
        status: "approved",
        decidedAt: Date.now(),
      });
      await publishLoanEvent(ctx, "loan.approved", (await ctx.db.get("loans", loanId))!);
      added.push("an active loan");
    }

    const borrowing = await ctx.db.query("loans").withIndex("by_borrowerId", (q) => q.eq("borrowerId", me._id)).take(100);
    const hasOverdue = borrowing.some((l) => l.status === "approved" && l.endDate < today);
    const mayaTools = await ctx.db.query("tools").withIndex("by_ownerId", (q) => q.eq("ownerId", maya)).take(5);
    if (!hasOverdue && mayaTools[0]) {
      await ctx.db.insert("loans", {
        toolId: mayaTools[0]._id,
        lenderId: maya,
        borrowerId: me._id,
        startDate: addDays(today, -5),
        endDate: addDays(today, -2),
        status: "approved",
        decidedAt: Date.now(),
      });
      added.push("an overdue loan to return");
    }
    return added.length ? `Gave ${me.name} ${added.join(", ")}.` : `${me.name} is already in the story.`;
  },
});

/** Seeding helpers for demo photos (scripts/seed-photos.mjs). Internal: never callable from a client. */
export const photoUploadUrl = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

/** Active listings with this exact name (each gets its own uploaded copy, so edits never affect another). */
export const toolsNamed = internalQuery({
  args: { toolName: v.string() },
  returns: v.array(v.id("tools")),
  handler: async (ctx, { toolName }) =>
    (await ctx.db.query("tools").withIndex("by_removedAt", (q) => q.eq("removedAt", undefined)).take(500))
      .filter((t) => t.name === toolName)
      .map((t) => t._id),
});

/** Replaces a listing's photos with one seeded photo. */
export const setToolPhoto = internalMutation({
  args: { toolId: v.id("tools"), storageId: v.id("_storage") },
  returns: v.null(),
  handler: async (ctx, { toolId, storageId }) => {
    const tool = await ctx.db.get("tools", toolId);
    if (!tool) {
      await ctx.storage.delete(storageId);
      return null;
    }
    for (const old of tool.photos ?? []) await ctx.storage.delete(old);
    await ctx.db.patch("tools", toolId, { photos: [storageId] });
    return null;
  },
});
