import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Apply drizzle/ migrations to Neon before each build, as Deep Thoughts does.
  buildCommand: "npm run db:migrate && npm run build",
  // The nightly market-data job, 9:30 pm Eastern (after Massive publishes the day's closes).
  crons: [{ path: "/api/jobs/nightly", schedule: "30 2 * * 2-6" }],
};
