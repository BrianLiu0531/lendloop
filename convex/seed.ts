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
import { internalMutation, type MutationCtx } from "./_generated/server";
import { addDays, toIsoDate } from "./lib/dates";
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

/** Puts the signed-in demo account into the story: an incoming request, an active loan and an overdue one. */
export const involve = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const me = (await ctx.db.query("users").take(500)).find((u) => u.email === email.toLowerCase());
    if (!me) throw new Error(`No user with email ${email} — sign in to the app once first.`);
    const maya = await upsertNeighbor(ctx, NEIGHBORS[0]);
    const omar = await upsertNeighbor(ctx, NEIGHBORS[1]);
    const today = toIsoDate(Date.now());

    const myTool = await ctx.db.insert("tools", {
      ownerId: me._id,
      name: "Circular saw",
      category: "power_tools",
      condition: "good",
      description: "7¼\" blade, with a spare blade and the rip fence.",
    });
    await ctx.db.insert("loans", {
      toolId: myTool,
      lenderId: me._id,
      borrowerId: omar,
      startDate: addDays(today, 1),
      endDate: addDays(today, 3),
      message: "Building a raised garden bed this weekend — happy to drop it back Monday morning!",
      status: "pending",
    });

    const mayaTools = await ctx.db.query("tools").withIndex("by_ownerId", (q) => q.eq("ownerId", maya)).take(5);
    if (mayaTools[0]) {
      await ctx.db.insert("loans", {
        toolId: mayaTools[0]._id,
        lenderId: maya,
        borrowerId: me._id,
        startDate: addDays(today, -5),
        endDate: addDays(today, -1),
        status: "approved",
        decidedAt: Date.now(),
      });
    }
    return `Gave ${me.name} a listing with an incoming request and an overdue loan to return.`;
  },
});
