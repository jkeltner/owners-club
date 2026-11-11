// Whether a build may apply migrations to the database it was given.
//
// Vercel gives preview builds the same DATABASE_URL as production, so a pull
// request's migration used to reach the production database the moment its
// preview built, before anyone had reviewed it. Now only a production build
// migrates. A preview migrates only when MIGRATE_PREVIEW_DATABASE=1 is set in
// the Preview environment, which is safe once previews have a database of
// their own (a Neon branch per preview). Local runs always migrate.
type Env = Record<string, string | undefined>;

export function migrationDecision(env: Env): { migrate: boolean; reason: string } {
  if (env.VERCEL !== "1") return { migrate: true, reason: "not a Vercel build" };
  if (env.VERCEL_ENV === "production") return { migrate: true, reason: "production build" };
  if (env.MIGRATE_PREVIEW_DATABASE === "1") return { migrate: true, reason: "MIGRATE_PREVIEW_DATABASE=1" };
  return {
    migrate: false,
    reason: `a ${env.VERCEL_ENV ?? "non-production"} build shares the production database; set MIGRATE_PREVIEW_DATABASE=1 once previews have their own`,
  };
}
