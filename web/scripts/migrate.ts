// Applies drizzle/ migrations to the database in DATABASE_URL (Neon, in the
// Vercel build). `npm run dev` migrates the local database on its own.
import "./env";
import { migrateDatabase } from "../src/db";
import { migrationDecision } from "../src/db/migrate_policy";

// Schema changes go over Neon's direct connection rather than the pooler.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  // A deploy without a database (before the Marketplace install, or a preview
  // with no database attached) still builds; the status page says it's not connected.
  console.warn("DATABASE_URL is not set; skipping migrations.");
  process.exit(0);
}

// Only a production build migrates the shared database (src/db/migrate_policy.ts).
const decision = migrationDecision(process.env);
if (!decision.migrate) {
  console.warn(`Skipping migrations: ${decision.reason}.`);
  process.exit(0);
}

migrateDatabase(url)
  .then(() => console.log("Migrations applied."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
