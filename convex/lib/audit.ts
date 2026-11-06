import type { MutationCtx } from "../_generated/server";
import type { Viewer } from "./auth";

export async function audit(
  ctx: MutationCtx,
  actor: Viewer | "system" | "n8n",
  action: string,
  target: { type: string; id: string },
  detail?: string,
) {
  await ctx.db.insert("auditLog", {
    actorId: typeof actor === "string" ? undefined : actor._id,
    actor: typeof actor === "string" ? actor : actor.name,
    action,
    targetType: target.type,
    targetId: target.id,
    detail,
  });
}
