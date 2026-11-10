import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Apply drizzle/ migrations to Neon before each build, as Deep Thoughts does.
  buildCommand: "npm run db:migrate && npm run build",
  // The nightly market-data job, 11:00 UTC Tuesday to Saturday: 6 am Eastern in winter, 7 am in
  // summer. Massive's free plan refuses a day's closes that same evening (a 403 at 9:30 pm Eastern).
  crons: [{ path: "/api/jobs/nightly", schedule: "0 11 * * 2-6" }],
};
