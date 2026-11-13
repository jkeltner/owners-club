// The app's tables. Game tables land phase by phase (docs/build_plan.md, "Data
// model"). Phase 0: sign-in and monitoring. Phase 1: the market-data cache,
// written only by jobs; every screen reads from these tables and never calls a
// provider. Better Auth's tables are generated into auth_schema.ts.
import { bigint, boolean, date, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { GameSettings } from "@/lib/rules";
import { user } from "./auth_schema";

export * from "./auth_schema";

export const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

export type EventLevel = "info" | "warn" | "error";

// Monitoring: server errors, failed jobs, model errors, rejected trades. Read by
// the daily ops routine. Messages and metadata only, never a player's words.
export const appEvents = pgTable(
  "app_events",
  {
    id: id(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    level: text("level").$type<EventLevel>().notNull(),
    // "server.render", "job.nightly", "coach.model", "trade.rejected", ...
    kind: text("kind").notNull(),
    message: text("message").notNull(),
    path: text("path"),
    detail: jsonb("detail").$type<Record<string, unknown>>(),
  },
  (t) => [index("app_events_at_idx").on(t.at), index("app_events_kind_idx").on(t.kind, t.at)],
);

// One row per job run (nightly, weekly, backfill), so the internal data page can
// show what ran, how long it took and what it changed, and a failed step can be
// re-run by hand.
export const jobRuns = pgTable(
  "job_runs",
  {
    id: id(),
    job: text("job").notNull(), // "nightly", "sp500", "financials", "prices", ...
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ok: boolean("ok"),
    // Per step: rows written, calls made, what was skipped.
    summary: jsonb("summary").$type<Record<string, unknown>>(),
    error: text("error"),
  },
  (t) => [index("job_runs_job_started_idx").on(t.job, t.startedAt)],
);

// ---- Market-data cache (written only by jobs) ----

export type CompanyStatus = "active" | "removed";

// The S&P 500 members. `lens` is our sector lens (a `kind` in
// content/sector_lenses.yaml) chosen from the GICS sector and sub-industry;
// null means no lens fits yet and the company gets the generic panel.
export const companies = pgTable(
  "companies",
  {
    ticker: text("ticker").primaryKey(),
    name: text("name").notNull(),
    cik: integer("cik"),
    sector: text("sector").notNull(), // GICS sector
    subIndustry: text("sub_industry").notNull(), // GICS sub-industry
    lens: text("lens"),
    // Plain "what it does and how it makes money", hand-written (docs/data_needs.md).
    oneLiner: text("one_liner"),
    status: text("status").$type<CompanyStatus>().notNull().default("active"),
    addedToIndex: date("added_to_index"),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("companies_cik_idx").on(t.cik), index("companies_sector_idx").on(t.sector)],
);

// Daily closes for every member plus the index fund (SPY stands in for the
// S&P 500 holding). Split-adjusted as delivered by the price source.
export const prices = pgTable(
  "prices",
  {
    ticker: text("ticker").notNull(),
    date: date("date").notNull(),
    close: doublePrecision("close").notNull(),
    volume: bigint("volume", { mode: "number" }),
    source: text("source").notNull(), // "massive", "alpha_vantage", ...
  },
  (t) => [primaryKey({ columns: [t.ticker, t.date] }), index("prices_date_idx").on(t.date)],
);

// Financials from SEC EDGAR's XBRL frames, one row per company per calendar
// period. `period` is EDGAR's frame name: "CY2025Q2" for a quarter (3-month
// flows; balance-sheet values as of the quarter end), "CY2025" for a fiscal
// year. Computed numbers (P/E, margins, growth) are functions over these rows,
// never columns, so they can't drift from their inputs (src/market/metrics.ts).
export const financials = pgTable(
  "financials",
  {
    cik: integer("cik").notNull(),
    period: text("period").notNull(),
    periodStart: date("period_start"),
    periodEnd: date("period_end"),
    revenue: bigint("revenue", { mode: "number" }),
    netIncome: bigint("net_income", { mode: "number" }),
    epsDiluted: doublePrecision("eps_diluted"),
    grossProfit: bigint("gross_profit", { mode: "number" }),
    operatingIncome: bigint("operating_income", { mode: "number" }),
    operatingCashFlow: bigint("operating_cash_flow", { mode: "number" }),
    capex: bigint("capex", { mode: "number" }),
    // Balance sheet, as of the period end.
    sharesOutstanding: bigint("shares_outstanding", { mode: "number" }),
    // Weighted-average diluted shares over the period (a flow-period number,
    // not an instant). Filled for dual-class filers whose shares outstanding
    // are only reported per share class, which the frames API leaves out.
    sharesDiluted: bigint("shares_diluted", { mode: "number" }),
    cash: bigint("cash", { mode: "number" }),
    longTermDebt: bigint("long_term_debt", { mode: "number" }),
    equity: bigint("equity", { mode: "number" }),
    goodwill: bigint("goodwill", { mode: "number" }),
    intangibles: bigint("intangibles", { mode: "number" }),
    // Which filing supplied the latest value, for the "where did this come from" link.
    accession: text("accession"),
    filed: date("filed"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cik, t.period] }), index("financials_period_idx").on(t.period)],
);

export type EarningsStatus = "estimated" | "confirmed" | "reported";

// Earnings dates, upcoming and past. Upcoming rows come from the calendar
// (estimated until the company confirms); reported rows carry the numbers
// the predictions are scored against.
export const earningsDates = pgTable(
  "earnings_dates",
  {
    ticker: text("ticker").notNull(),
    date: date("date").notNull(),
    status: text("status").$type<EarningsStatus>().notNull(),
    fiscalPeriodEnd: date("fiscal_period_end"),
    reportTime: text("report_time"), // "pre-market", "post-market", or null
    reportedEps: doublePrecision("reported_eps"),
    source: text("source").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.ticker, t.date] }), index("earnings_dates_date_idx").on(t.date)],
);

// News headlines that link out. Title, source and URL only; we never store or
// show article text.
export const headlines = pgTable(
  "headlines",
  {
    id: id(),
    ticker: text("ticker").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    title: text("title").notNull(),
    url: text("url").notNull().unique(),
    source: text("source").notNull(),
  },
  (t) => [index("headlines_ticker_published_idx").on(t.ticker, t.publishedAt)],
);

// The part-A reference numbers from docs/data_needs.md (index return, SPIVA
// share, top-10 share, ...), each with its source and when it was fetched or
// entered. Values are JSON so a row can hold a number, a range or a table.
export const reference = pgTable("reference", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  unit: text("unit"),
  source: text("source").notNull(),
  sourceUrl: text("source_url"),
  asOf: date("as_of"),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---- Accounts and clubs (phase 2) ----


// A club is a private group playing one game with one set of rules.
export const clubs = pgTable("clubs", {
  id: id(),
  name: text("name").notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  // The club's game settings; the concept doc's defaults unless an organizer changes them.
  settings: jsonb("settings").$type<GameSettings>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type MemberRole = "organizer" | "member";

// One person in one club. This is "the player": every portfolio table hangs
// off a membership, so the same person in two clubs has two portfolios.
export const memberships = pgTable(
  "memberships",
  {
    id: id(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    avatar: text("avatar").notNull(),
    role: text("role").$type<MemberRole>().notNull().default("member"),
    // An organizer can run a club without playing (a teacher). Non-playing
    // organizers see the whole club in dollars; playing ones see what a player sees.
    plays: boolean("plays").notNull().default(true),
    inviteId: text("invite_id"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("memberships_club_user_idx").on(t.clubId, t.userId), index("memberships_user_idx").on(t.userId)],
);

// The Agree click: 13 or older, the Terms and the Privacy Policy, by version.
export const agreements = pgTable(
  "agreements",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    termsVersion: text("terms_version").notNull(),
    agreedAt: timestamp("agreed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("agreements_user_version_idx").on(t.userId, t.termsVersion)],
);

// An invite link. One link serves the whole club until it expires or an
// organizer turns it off; each membership records the link it came through.
export const invites = pgTable(
  "invites",
  {
    id: id(),
    clubId: text("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    code: text("code").notNull().unique(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("invites_club_idx").on(t.clubId)],
);
