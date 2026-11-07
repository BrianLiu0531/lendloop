/**
 * Listing photos, stored in Convex file storage.
 *
 * Flow: generateUploadUrl → browser POSTs the (already re-encoded, EXIF-free)
 * image → registerUpload records who uploaded it → tools.create/update attach
 * it. Every check that matters happens here on the server: type, size,
 * count, and that you can only attach files you uploaded yourself.
 */
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, type MutationCtx, type QueryCtx } from "./_generated/server";
import { invalid } from "./lib/errors";
import { userMutation } from "./lib/functions";
import { rateLimiter } from "./lib/rateLimits";
import { LIMITS } from "./lib/validators";

const ABANDONED_AFTER_MS = 24 * 60 * 60 * 1000;

export const generateUploadUrl = userMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    await rateLimiter.limit(ctx, "uploadPhoto", { key: ctx.viewer._id, throws: true });
    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Validates an uploaded file and records the uploader. Invalid files are
 * deleted immediately, so this returns an error instead of throwing: a throw
 * would roll the delete back.
 */
export const registerUpload = userMutation({
  args: { storageId: v.id("_storage") },
  returns: v.object({ ok: v.boolean(), error: v.optional(v.string()) }),
  handler: async (ctx, { storageId }) => {
    const meta = await ctx.db.system.get("_storage", storageId);
    if (!meta) throw invalid("Upload not found.");
    const claimed = await ctx.db
      .query("photoUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", storageId))
      .unique();
    if (claimed) {
      if (claimed.userId !== ctx.viewer._id) throw invalid("Upload not found.");
      return { ok: true };
    }
    const okType = (LIMITS.photos.types as readonly string[]).includes(meta.contentType ?? "");
    if (!okType || meta.size > LIMITS.photos.maxBytes) {
      await ctx.storage.delete(storageId);
      return { ok: false, error: okType ? "That photo is too large (max 3 MB)." : "Photos must be JPEG, PNG or WebP." };
    }
    await ctx.db.insert("photoUploads", { storageId, userId: ctx.viewer._id });
    return { ok: true };
  },
});

/**
 * Resolves the photo list for a create/update. Keeps photos already on the
 * listing, claims new ones only if this user uploaded them, and deletes
 * photos that were dropped from the listing.
 */
export async function attachPhotos(
  ctx: MutationCtx,
  viewer: Doc<"users">,
  requested: Id<"_storage">[],
  existing: Id<"_storage">[] = [],
): Promise<Id<"_storage">[]> {
  const ids = [...new Set(requested)];
  if (ids.length > LIMITS.photos.max) throw invalid(`At most ${LIMITS.photos.max} photos per listing.`);
  for (const id of ids) {
    if (existing.includes(id)) continue;
    const upload = await ctx.db
      .query("photoUploads")
      .withIndex("by_storageId", (q) => q.eq("storageId", id))
      .unique();
    if (!upload || upload.userId !== viewer._id) throw invalid("One of the photos couldn't be found. Try uploading it again.");
    await ctx.db.delete("photoUploads", upload._id);
  }
  for (const id of existing) {
    if (!ids.includes(id)) await ctx.storage.delete(id);
  }
  return ids;
}

/** Deletes every photo on a listing (used when it's removed: nothing lingers). */
export async function deletePhotos(ctx: MutationCtx, photos: Id<"_storage">[] = []) {
  for (const id of photos) await ctx.storage.delete(id);
}

export async function photoUrls(ctx: QueryCtx, photos: Id<"_storage">[] = []) {
  const urls = await Promise.all(photos.map((id) => ctx.storage.getUrl(id)));
  return urls.filter((u): u is string => u !== null);
}

/** For the owner's edit form: ids (to keep or drop) alongside display URLs. */
export async function photoItems(ctx: QueryCtx, photos: Id<"_storage">[] = []) {
  const items = await Promise.all(photos.map(async (id) => ({ id, url: await ctx.storage.getUrl(id) })));
  return items.filter((p): p is { id: Id<"_storage">; url: string } => p.url !== null);
}

export async function coverUrl(ctx: QueryCtx, photos: Id<"_storage">[] = []) {
  return photos[0] ? await ctx.storage.getUrl(photos[0]) : null;
}

/** Cron: files uploaded but never attached (abandoned forms) are deleted after a day. */
export const collectAbandoned = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const cutoff = Date.now() - ABANDONED_AFTER_MS;
    const stale = await ctx.db
      .query("photoUploads")
      .filter((q) => q.lt(q.field("_creationTime"), cutoff))
      .take(200);
    for (const row of stale) {
      await ctx.storage.delete(row.storageId);
      await ctx.db.delete("photoUploads", row._id);
    }
    return stale.length;
  },
});
