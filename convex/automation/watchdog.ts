import { internalMutation } from "../_generated/server";
import { SWEEP_STALE_AFTER_MS } from "../admin";
import { toIsoDate } from "../lib/dates";
import { OVERDUE_WORKFLOW } from "./inbound";

/**
 * Dead-man's switch for the daily n8n sweep. An error workflow only fires
 * when a run *fails*; it can't notice a run that never starts (n8n down,
 * workflow deactivated, schedule edited). This cron can: if the last
 * reported sweep is too old, it raises a failure that admins see.
 * Keyed per day, so it alerts once a day, not once an hour.
 */
export const checkOverdueSweep = internalMutation({
  args: {},
  handler: async (ctx) => {
    const last = await ctx.db
      .query("automationRuns")
      .withIndex("by_workflow", (q) => q.eq("workflow", OVERDUE_WORKFLOW))
      .order("desc")
      .first();
    // Before the first run ever, there is nothing to compare against.
    if (!last || Date.now() - last.finishedAt <= SWEEP_STALE_AFTER_MS) return null;

    const executionId = `watchdog:${OVERDUE_WORKFLOW}:${toIsoDate(Date.now())}`;
    const already = await ctx.db
      .query("automationFailures")
      .withIndex("by_executionId", (q) => q.eq("executionId", executionId))
      .unique();
    if (already) return null;

    const hours = Math.round((Date.now() - last.finishedAt) / 3_600_000);
    await ctx.db.insert("automationFailures", {
      executionId,
      workflow: OVERDUE_WORKFLOW,
      node: "watchdog",
      message: `No overdue sweep has reported in ${hours}h (last run: ${new Date(last.finishedAt).toISOString()}). Check that n8n is up and the workflow is active.`,
      occurredAt: Date.now(),
    });
    console.error(`[watchdog] overdue sweep stale for ${hours}h`);
    return null;
  },
});
