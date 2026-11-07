import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Clerk session handling + Content-Security-Policy for every request.
 *
 * Deliberately no path-based auth rules here: route protection happens in
 * the (app) layout (`auth.protect()`), and data authorization happens in
 * every Convex function — the only layer that can actually read data.
 */
const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? "";
const convexWs = convexUrl.replace(/^http/, "ws");

export default clerkMiddleware({
  // Clerk merges its own required sources with these.
  contentSecurityPolicy: {
    directives: {
      "connect-src": [convexUrl, convexWs].filter(Boolean),
      // Convex storage serves listing photos; blob: is the local preview before upload.
      "img-src": ["https://img.clerk.com", convexUrl, "blob:"].filter(Boolean),
    },
  },
});

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
