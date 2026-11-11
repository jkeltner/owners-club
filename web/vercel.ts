import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Apply drizzle/ migrations to Neon before each production build, as Deep Thoughts does.
  // Preview builds skip them: they share the production database (src/db/migrate_policy.ts).
  buildCommand: "npm run db:migrate && npm run build",
  // The nightly market-data job, 06:00 UTC Tuesday to Saturday: 1 am Eastern in winter, 2 am in
  // summer. Massive's free plan serves a day's closes from midnight Eastern, not that evening.
  crons: [{ path: "/api/jobs/nightly", schedule: "0 6 * * 2-6" }],
};
