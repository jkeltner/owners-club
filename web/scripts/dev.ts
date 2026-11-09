// Local development: runs an embedded Postgres (PGlite, stored in .data/pglite)
// as a real Postgres server, applies migrations, then starts `next dev` pointed
// at it. Next's dev server uses more than one process, so the database has to
// live in its own process rather than inside the app. Same shape as Deep Thoughts.
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const PORT = Number(process.env.LOCAL_DB_PORT ?? 54331);
const dataDir = path.join(process.cwd(), ".data", "pglite");

async function main() {
  mkdirSync(path.dirname(dataDir), { recursive: true });
  const pg = new PGlite({ dataDir });
  await migrate(drizzle({ client: pg }), { migrationsFolder: path.join(process.cwd(), "drizzle") });

  const server = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: PORT, maxConnections: 20 });
  await server.start();
  const databaseUrl = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres?sslmode=disable`;
  console.log(`[db] local Postgres (PGlite) on ${databaseUrl}`);

  const next = spawn("npx", ["next", "dev", ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: databaseUrl, DATABASE_POOL_MAX: "10" },
  });

  let stopping = false;
  const stop = async (code = 0) => {
    if (stopping) return;
    stopping = true;
    next.kill("SIGTERM");
    await server.stop().catch(() => {});
    await pg.close().catch(() => {});
    process.exit(code);
  };
  next.on("exit", (code) => stop(code ?? 0));
  process.on("SIGINT", () => stop(0));
  process.on("SIGTERM", () => stop(0));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
