import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

/**
 * Per-user abuse limits. Enforced inside the mutation's transaction, so a
 * rejected call consumes nothing and a failed mutation refunds its token.
 */
export const rateLimiter = new RateLimiter(components.rateLimiter, {
  createTool: { kind: "token bucket", rate: 20, period: HOUR, capacity: 10 },
  requestLoan: { kind: "token bucket", rate: 10, period: HOUR, capacity: 5 },
  uploadPhoto: { kind: "token bucket", rate: 60, period: HOUR, capacity: 12 },
  loanAction: { kind: "token bucket", rate: 60, period: MINUTE, capacity: 20 },
});
