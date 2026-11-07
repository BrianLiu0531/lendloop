/** Listing photos: type/size validation, ownership of uploads, cleanup. */
import { describe, expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { ALICE, BOB, setup } from "./test.setup";

const tool = { name: "Cordless drill", category: "power_tools", condition: "good", description: "" } as const;

async function world() {
  const t = setup();
  const alice = t.withIdentity(ALICE);
  const bob = t.withIdentity(BOB);
  await alice.mutation(api.users.ensure, {});
  await bob.mutation(api.users.ensure, {});
  const store = (type: string, bytes = 1024) =>
    t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)], { type })));
  return { t, alice, bob, store };
}

function rejects(p: Promise<unknown>, code: string) {
  return expect(p).rejects.toMatchObject({ data: { code } });
}

describe("photos", () => {
  test("owner can attach their own uploads; the cover URL shows on the board", async () => {
    const { alice, bob, store } = await world();
    const photo = await store("image/webp");
    await alice.mutation(api.photos.registerUpload, { storageId: photo });
    await alice.mutation(api.tools.create, { ...tool, photos: [photo] });
    const [row] = await bob.query(api.tools.list, { today: "2026-01-01" });
    expect(row.coverUrl).toEqual(expect.any(String));
  });

  test("you can't attach a file someone else uploaded", async () => {
    const { alice, bob, store } = await world();
    const photo = await store("image/webp");
    await bob.mutation(api.photos.registerUpload, { storageId: photo });
    await rejects(alice.mutation(api.tools.create, { ...tool, photos: [photo] }), "INVALID");
    await rejects(alice.mutation(api.photos.registerUpload, { storageId: photo }), "INVALID");
  });

  test("unregistered uploads can't be attached", async () => {
    const { alice, store } = await world();
    const photo = await store("image/webp");
    await rejects(alice.mutation(api.tools.create, { ...tool, photos: [photo] }), "INVALID");
  });

  test("non-images and oversized files are rejected and deleted", async () => {
    const { t, alice, store } = await world();
    const pdf = await store("application/pdf");
    expect(await alice.mutation(api.photos.registerUpload, { storageId: pdf })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", pdf))).toBeNull();
    const huge = await store("image/jpeg", 4 * 1024 * 1024);
    expect(await alice.mutation(api.photos.registerUpload, { storageId: huge })).toMatchObject({ ok: false });
    await rejects(alice.mutation(api.tools.create, { ...tool, photos: [huge] }), "INVALID");
  });

  test("at most four photos per listing", async () => {
    const { alice, store } = await world();
    const ids: Id<"_storage">[] = [];
    for (let i = 0; i < 5; i++) {
      const id = await store("image/webp");
      await alice.mutation(api.photos.registerUpload, { storageId: id });
      ids.push(id);
    }
    await rejects(alice.mutation(api.tools.create, { ...tool, photos: ids }), "INVALID");
  });

  test("dropped photos and removed listings delete their files", async () => {
    const { t, alice, store } = await world();
    const [a, b] = [await store("image/webp"), await store("image/webp")];
    for (const id of [a, b]) await alice.mutation(api.photos.registerUpload, { storageId: id });
    const toolId = await alice.mutation(api.tools.create, { ...tool, photos: [a, b] });
    await alice.mutation(api.tools.update, { toolId, ...tool, photos: [b] });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", a))).toBeNull();
    await alice.mutation(api.tools.remove, { toolId });
    expect(await t.run((ctx) => ctx.db.system.get("_storage", b))).toBeNull();
  });

  test("abandoned uploads are garbage-collected", async () => {
    const { t, alice, store } = await world();
    const photo = await store("image/webp");
    await alice.mutation(api.photos.registerUpload, { storageId: photo });
    expect(await t.mutation(internal.photos.collectAbandoned, {})).toBe(0); // fresh: kept
  });
});
