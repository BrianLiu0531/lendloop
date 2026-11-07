/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as automation_delivery from "../automation/delivery.js";
import type * as automation_inbound from "../automation/inbound.js";
import type * as automation_signing from "../automation/signing.js";
import type * as automation_watchdog from "../automation/watchdog.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_audit from "../lib/audit.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_availability from "../lib/availability.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_functions from "../lib/functions.js";
import type * as lib_loanView from "../lib/loanView.js";
import type * as lib_outbox from "../lib/outbox.js";
import type * as lib_policy from "../lib/policy.js";
import type * as lib_privacy from "../lib/privacy.js";
import type * as lib_rateLimits from "../lib/rateLimits.js";
import type * as lib_validators from "../lib/validators.js";
import type * as loans from "../loans.js";
import type * as photos from "../photos.js";
import type * as seed from "../seed.js";
import type * as tools from "../tools.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  "automation/delivery": typeof automation_delivery;
  "automation/inbound": typeof automation_inbound;
  "automation/signing": typeof automation_signing;
  "automation/watchdog": typeof automation_watchdog;
  crons: typeof crons;
  http: typeof http;
  "lib/audit": typeof lib_audit;
  "lib/auth": typeof lib_auth;
  "lib/availability": typeof lib_availability;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/functions": typeof lib_functions;
  "lib/loanView": typeof lib_loanView;
  "lib/outbox": typeof lib_outbox;
  "lib/policy": typeof lib_policy;
  "lib/privacy": typeof lib_privacy;
  "lib/rateLimits": typeof lib_rateLimits;
  "lib/validators": typeof lib_validators;
  loans: typeof loans;
  photos: typeof photos;
  seed: typeof seed;
  tools: typeof tools;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  rateLimiter: import("@convex-dev/rate-limiter/_generated/component.js").ComponentApi<"rateLimiter">;
};
