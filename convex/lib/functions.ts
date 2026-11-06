/**
 * Function builders that bake authentication/authorization into the
 * function definition itself. Every public function in this app is built
 * with one of these, so "forgot to check auth" can't happen by omission:
 *
 *   publicQuery   – no identity required (landing page only)
 *   userQuery     – signed in; `ctx.viewer` is the caller's users row
 *   userMutation  – signed in
 *   adminQuery    – signed in + role === "admin"
 *   adminMutation – signed in + role === "admin"
 *
 * Resource-level rules (owner-only edits etc.) live in ./policy.ts and are
 * called inside the handlers.
 */
import { customCtx, customMutation, customQuery } from "convex-helpers/server/customFunctions";
import { mutation, query } from "../_generated/server";
import { requireAdmin, requireViewer } from "./auth";

export const publicQuery = query;

export const userQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await requireViewer(ctx) })),
);

export const userMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ viewer: await requireViewer(ctx) })),
);

export const adminQuery = customQuery(
  query,
  customCtx(async (ctx) => ({ viewer: await requireAdmin(ctx) })),
);

export const adminMutation = customMutation(
  mutation,
  customCtx(async (ctx) => ({ viewer: await requireAdmin(ctx) })),
);
