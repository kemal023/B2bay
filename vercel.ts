import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  crons: [
    {
      path: "/api/cron/sync-suppliers",
      // Every 30 minutes. Adjust per supplier via each supplier's own
      // syncIntervalMinutes setting is not enforced by this cron itself —
      // this just decides how often we check in; syncSupplier() re-fetches
      // every active supplier on each run.
      schedule: "*/30 * * * *",
    },
  ],
};
