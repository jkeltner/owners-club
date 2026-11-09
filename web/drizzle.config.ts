import { defineConfig } from "drizzle-kit";

// Migrations are generated from the schema (`npm run db:generate`) and applied
// by scripts/dev.ts locally (PGlite) or `npm run db:migrate` (Neon, in the build).
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
});
