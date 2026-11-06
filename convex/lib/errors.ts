import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID"
  | "CONFLICT"
  | "RATE_LIMITED";

/**
 * Structured, client-safe error. The UI shows `message`; `code` lets it
 * branch (e.g. send unauthenticated users to sign in). Never put internal
 * details (stack traces, other users' data) in here.
 */
export function appError(code: AppErrorCode, message: string) {
  return new ConvexError({ code, message });
}

export const forbidden = (message = "You don't have permission to do that.") =>
  appError("FORBIDDEN", message);
export const notFound = (what = "That item") => appError("NOT_FOUND", `${what} was not found.`);
export const invalid = (message: string) => appError("INVALID", message);
export const conflict = (message: string) => appError("CONFLICT", message);
