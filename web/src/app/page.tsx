// Phase 0 status page: proves the deploy, the database and the content bundle
// are wired together. Replaced by the real app as the phases land.
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { concepts, lessons, scenarios, lenses, glossary } from "@/content";

export const dynamic = "force-dynamic";

async function databaseStatus() {
  if (!process.env.DATABASE_URL) return { ok: false as const, error: "no database attached to this deployment yet" };
  try {
    const rows = (await db.execute(sql`select now() as now, version() as version`)) as unknown as { rows: { now: Date; version: string }[] };
    const row = rows.rows?.[0];
    return { ok: true as const, now: new Date(row.now).toISOString(), version: row.version.split(" on ")[0] };
  } catch (err) {
    return { ok: false as const, error: err instanceof Error ? err.message : String(err) };
  }
}

export default async function Home() {
  const dbStatus = await databaseStatus();
  const commit = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const env = process.env.VERCEL_ENV ?? "development";

  return (
    <main className="status">
      <h1>Owners Club</h1>
      <p className="sub">The real build, phase 0. Nothing to play yet.</p>

      <section className="card">
        <h2>Content</h2>
        <dl>
          <dt>Concepts</dt>
          <dd>{concepts.length}</dd>
          <dt>Lessons</dt>
          <dd>{lessons.length}</dd>
          <dt>Time machine scenarios</dt>
          <dd>{scenarios.length}</dd>
          <dt>Sector lenses</dt>
          <dd>{lenses.length}</dd>
          <dt>Glossary terms</dt>
          <dd>{glossary.length}</dd>
        </dl>
      </section>

      <section className="card">
        <h2>Database</h2>
        {dbStatus.ok ? (
          <dl>
            <dt>Connected</dt>
            <dd>yes</dd>
            <dt>Server time</dt>
            <dd>{dbStatus.now}</dd>
            <dt>Engine</dt>
            <dd>{dbStatus.version}</dd>
          </dl>
        ) : (
          <p>Not connected: {dbStatus.error}</p>
        )}
      </section>

      <section className="card">
        <h2>Deploy</h2>
        <dl>
          <dt>Environment</dt>
          <dd>{env}</dd>
          <dt>Commit</dt>
          <dd>{commit}</dd>
        </dl>
      </section>

      <p className="sub">
        The playtest prototype is still at <a href="https://owners-club-alpha.vercel.app">owners-club-alpha.vercel.app</a>.
      </p>
    </main>
  );
}
