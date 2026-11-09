# Build log

One note per phase of the real build (see [the build plan](build_plan.md)): what shipped, what changed in the plan, what's waiting on someone.

## Phase 0: kickoff (2026-11-09)

**Shipped.** `web/` is a Next.js 16 app in the Deep Thoughts shape: Postgres over one connection string (Neon online, embedded PGlite locally and in tests), Drizzle migrations applied in the Vercel build, Better Auth with Google and email one-time codes, an `app_events` table fed by every uncaught server error. The shared `content/` catalogs are bundled at build time. The prototype's game rules, ranks and formatting are ported with unit tests that pin the concept doc's defaults. Live at https://owners-club-web.vercel.app as a status page.

**Hosting.** Vercel project `owners-club-web` in Jeff's Projects (Jeff is upgrading the team to Pro), root directory `web/`, GitHub connected so `main` deploys. The prototype keeps the `owners-club` project name and owners-club-alpha.vercel.app. A project briefly created in the Solar Car Club's Pro team was deleted the same day.

**Plan changes.** Neon over Supabase; pipeline first, in about a week; a new adult pilot phase before any kid plays; Pro from day one. Recorded in the plan and the decision log.

**Waiting on Jeff.** Sending the Alpha Vantage display-permission email (drafted in Gmail).

## Phase 1: market data layer (started 2026-11-09)

**Shipped so far.** The market-data cache tables (`companies`, `prices`, `financials`, `earnings_dates`, `headlines`, `reference`) and a `job_runs` table. Four adapters behind one nightly job with idempotent steps: the S&P 500 list from Wikipedia's maintained table (503 members, GICS sector and sub-industry, CIK, mapped to our nine lenses: 177 get one), daily closes from Massive's grouped-daily endpoint with SPY standing in for the index holding, financials from SEC EDGAR's XBRL frames API (one call per concept per calendar period covers every filer; the 10-K quarter is derived as year minus the other three), and the earnings calendar plus reported numbers from Alpha Vantage. Computed metrics (market cap, P/E, trailing revenue and margins, growth, free cash flow, Rule of 40, return on equity, price to book) are pure functions over the stored rows, with tests. Vercel Cron runs the job at 9:30 pm Eastern, Tuesday to Saturday. An internal page at `/admin` (Google sign-in, admins by email) shows the job runs, sector P/E bands, upcoming earnings and every company with its numbers, and can run any step by hand. `scripts/backfill.ts` runs the same steps with a wider window.

**Decisions made here.** Wikipedia for the member list (S&P's own list is licensed; Wikipedia tracks changes within a day or two, and removed members are marked, not deleted). EDGAR frames rather than the bulk download (a few dozen small calls a night instead of a multi-gigabyte file). SPY for the index holding's price. Headlines deferred to phase 3, for companies players hold: the free Alpha Vantage key allows 25 calls a day.

**Done by Jeff (2026-11-09 evening).** Google OAuth variables moved to `owners-club-web`; the SEC contact for `MARKET_USER_AGENT` is his address (set in all three Vercel environments); Jeff's Projects upgraded to Pro.

**Loaded 2026-11-09 evening.** Financials: 12,776 rows across 26 periods (every quarter back to late 2021 and every fiscal year back to 2020) for all 500 members with a CIK; 437 have a third-quarter 2026 filing so far, the rest report later or on off-cycle years. Earnings calendar: 79 upcoming dates through late January (fewer than expected for a three-month window; check against the next nightly run). The first backfill surfaced an ambiguous-column bug in the financials upsert (fixed, with a test) and a burst-rate rejection from Alpha Vantage (lookups now paced at one a second). `scripts/stats.ts` prints what the cache holds.

**Waiting on Jeff.** A working Massive key: the value added to Vercel is 11 characters and Massive answers "Unknown API Key" to it; their keys are 32 characters, so it looks truncated. Prices stay empty until it's replaced.

**Still to do in this phase.** Two years of prices once the Massive key works (`npx tsx scripts/backfill.ts prices`, about two hours at the free tier's pace, resumable); the five clean nights; the EDGAR cleanup the internal page turns up (banks with no gross profit, fiscal-year offsets, restated quarters); the part-A reference numbers.
