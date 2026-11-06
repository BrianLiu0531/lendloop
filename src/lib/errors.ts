import { ConvexError } from "convex/values";

/** Turns any thrown value into a message that is safe and useful to show. */
export function errorMessage(error: unknown): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: string; kind?: string; retryAfter?: number } | string;
    if (typeof data === "string") return data;
    if (data?.kind === "RateLimited") {
      const secs = Math.ceil((data.retryAfter ?? 0) / 1000);
      return `You're doing that a lot — try again in ${secs > 60 ? `${Math.ceil(secs / 60)} min` : `${secs}s`}.`;
    }
    if (data?.message) return data.message;
  }
  return "Something went wrong. Please try again.";
}
