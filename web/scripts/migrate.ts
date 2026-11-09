// Applies drizzle/ migrations to the database in DATABASE_URL (Neon, in the
// Vercel build). `npm run dev` migrates the local database on its own.
import "./env";
import { migrateDatabase } from "../src/db";

// Schema changes go over Neon's direct connection rather than the pooler.
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  // A deploy without a database (before the Marketplace install, or a preview
  // with no database attached) still builds; the status page says it's not connected.
  console.warn("DATABASE_URL is not set; skipping migrations.");
  process.exit(0);
}

migrateDatabase(url)
  .then(() => console.log("Migrations applied."))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
