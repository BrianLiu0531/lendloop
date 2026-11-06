import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval("overdue sweep watchdog", { hours: 1 }, internal.automation.watchdog.checkOverdueSweep, {});

export default crons;
