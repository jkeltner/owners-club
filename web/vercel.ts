import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Apply drizzle/ migrations to Neon before each build, as Deep Thoughts does.
  buildCommand: "npm run db:migrate && npm run build",
};
