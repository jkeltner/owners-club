import path from "node:path";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export const migrationsFolder = path.join(process.cwd(), "drizzle");

// Neon's connection strings say sslmode=require. pg 8 already treats that as
// verify-full and warns on every cold start that the alias will change meaning
// in pg 9. Say verify-full outright. Local PGlite URLs say sslmode=disable.
export function withVerifiedSsl(url: string | undefined) {
  return url?.replace(/([?&])sslmode=(prefer|require|verify-ca)(?=&|$)/, "$1sslmode=verify-full");
}

// The app always talks to Postgres over DATABASE_URL: Neon online, and locally a
// PGlite server that `npm run dev` starts (scripts/dev.ts). Tests use an
// in-memory PGlite in the same process (PGLITE_DIR=memory://).
function createDb(): { db: Db; ready: Promise<void> } {
  if (process.env.PGLITE_DIR === "memory://") return createTestDb();
  const url = process.env.DATABASE_URL;
  // The build imports route modules without a database; queries would fail, nothing runs them.
  if (!url && process.env.NEXT_PHASE !== "phase-production-build") {
    console.error("DATABASE_URL is not set. Start the app with `npm run dev`, which runs a local database.");
  }
  const pool = new Pool({ connectionString: withVerifiedSsl(url), max: Number(process.env.DATABASE_POOL_MAX ?? 10) });
  return { db: drizzlePg({ client: pool, schema }) as unknown as Db, ready: Promise.resolve() };
}

function createTestDb(): { db: Db; ready: Promise<void> } {
  // Loaded lazily so production bundles never pull in PGlite.
  let testDb: Db | undefined;
  const ready = (async () => {
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const client = new PGlite();
    const pgliteDb = drizzle({ client, schema });
    await migrate(pgliteDb, { migrationsFolder });
    testDb = pgliteDb as unknown as Db;
  })();
  const db = new Proxy({} as Db, {
    get(_target, prop) {
      if (!testDb) throw new Error("Test database not ready: await dbReady first.");
      return Reflect.get(testDb, prop);
    },
  });
  return { db, ready };
}

const globalForDb = globalThis as unknown as { __oc_db?: ReturnType<typeof createDb> };
const instance = (globalForDb.__oc_db ??= createDb());

export const db = instance.db;

/** Resolves once the database is usable. Only the in-memory test database needs it. */
export const dbReady = instance.ready;

/** Applies drizzle/ migrations to DATABASE_URL (Neon, or the local PGlite server). */
export async function migrateDatabase(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({ connectionString: withVerifiedSsl(url), max: 1 });
  try {
    await migratePg(drizzlePg({ client: pool }), { migrationsFolder });
  } finally {
    await pool.end();
  }
}
