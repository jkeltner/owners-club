# Build log

One note per phase of the real build (see [the build plan](build_plan.md)): what shipped, what changed in the plan, what's waiting on someone.

## Phase 0: kickoff (2026-11-09)

**Shipped.** `web/` is a Next.js 16 app in the Deep Thoughts shape: Postgres over one connection string (Neon online, embedded PGlite locally and in tests), Drizzle migrations applied in the Vercel build, Better Auth with Google and email one-time codes, an `app_events` table fed by every uncaught server error. The shared `content/` catalogs are bundled at build time. The prototype's game rules, ranks and formatting are ported with unit tests that pin the concept doc's defaults. Live at https://owners-club-web.vercel.app as a status page.

**Hosting.** Vercel project `owners-club-web` in Jeff's Projects (Jeff is upgrading the team to Pro), root directory `web/`, GitHub connected so `main` deploys. The prototype keeps the `owners-club` project name and owners-club-alpha.vercel.app. A project briefly created in the Solar Car Club's Pro team was deleted the same day.

**Plan changes.** Neon over Supabase; pipeline first, in about a week; a new adult pilot phase before any kid plays; Pro from day one. Recorded in the plan and the decision log.

**Waiting on Jeff.** Sending the Alpha Vantage display-permission email (drafted in Gmail).

## Phase 1: market data layer (started 2026-11-09)

**Shipped so far.** The market-data cache tables (`companies`, `prices`, `financials`, `earnings_dates`, `headlines`, `reference`) and a `job_runs` table. Four adapters behind one nightly job with idempotent steps: the S&P 500 list from Wikipedia's maintained table (503 members, GICS sector and sub-industry, CIK, mapped to our nine lenses: 177 get one), daily closes from Massive's grouped-daily endpoint with SPY standing in for the index holding, financials from SEC EDGAR's XBRL frames API (one call per concept per calendar period covers every filer; the 10-K quarter is derived as year minus the other three), and the earnings calendar plus reported numbers from Alpha Vantage. Computed metrics (market cap, P/E, trailing revenue and margins, growth, free cash flow, Rule of 40, return on equity, price to book) are pure functions over the stored rows, with tests. Vercel Cron runs the job at 06:00 UTC (1 am Eastern in winter), Tuesday to Saturday; it started at 9:30 pm Eastern and moved on 2026-11-10 and 2026-11-11 (below). An internal page at `/admin` (Google sign-in, admins by email) shows the job runs, sector P/E bands, upcoming earnings and every company with its numbers, and can run any step by hand. `scripts/backfill.ts` runs the same steps with a wider window.

**Decisions made here.** Wikipedia for the member list (S&P's own list is licensed; Wikipedia tracks changes within a day or two, and removed members are marked, not deleted). EDGAR frames rather than the bulk download (a few dozen small calls a night instead of a multi-gigabyte file). SPY for the index holding's price. Headlines deferred to phase 3, for companies players hold: the free Alpha Vantage key allows 25 calls a day.

**Done by Jeff (2026-11-09 evening).** Google OAuth variables moved to `owners-club-web`; the SEC contact for `MARKET_USER_AGENT` is his address (set in all three Vercel environments); Jeff's Projects upgraded to Pro.

**Loaded 2026-11-09 evening.** Financials: 12,776 rows across 26 periods (every quarter back to late 2021 and every fiscal year back to 2020) for all 500 members with a CIK; 437 have a third-quarter 2026 filing so far, the rest report later or on off-cycle years. Earnings calendar: 79 upcoming dates through late January (fewer than expected for a three-month window; check against the next nightly run). The first backfill surfaced an ambiguous-column bug in the financials upsert (fixed, with a test) and a burst-rate rejection from Alpha Vantage (lookups now paced at one a second). `scripts/stats.ts` prints what the cache holds.

**Loaded 2026-11-09 night.** Prices: 247,582 closes over 499 trading days (2024-11-11 to 2026-11-06) for all 503 members plus SPY, two hours at Massive's free-tier pace. Twelve members have shorter histories because they listed or changed ticker inside the window (SKYD, VYLR, VMRK, HONA, ECHO, FDXF, P, MRSH, FISV, Q, SNDK; BNY has a gap). Massive returns split-adjusted volumes as fractions, so the loader rounds them. The keys needed for local scripts are Sensitive variables in Vercel, which `vercel env pull` can't read (it writes `[SENSITIVE]`); Jeff pasted them into `web/.env.local` by hand. (A false alarm on 2026-11-09 blamed a "truncated" key for this.)

**First look at the computed numbers (2026-11-09).** `scripts/admin_check.ts` prints what `/admin` shows. The big names match finance sites: Apple at $342.37 is a $5.0T market cap and a P/E of 38.8 (YCharts and the Motley Fool showed 37.9 to 39.4 that day); Nvidia, Microsoft, Alphabet and Amazon look right; the market P/E comes out at 23.9; the sector bands make sense (banks 10.6 to 12.5, energy 7.1 to 15.5, chipmakers 24.8 to 45.6, software 18.7 to 49.9). What needs cleanup before players see these: 41 members have no shares outstanding in the EDGAR frames (mostly dual-class filers such as META, V, MA, BRK.B, CMCSA, UPS, NKE, ACN), so they have no market cap or P/E; fall back to diluted weighted shares or net income over EPS. Dual listings (GOOG/GOOGL, FOX/FOXA, NWS/NWSA) count twice in index-wide totals. A handful of May/April fiscal years (General Mills, Smucker, FedEx) show as loss-making, which points at the fiscal-year-offset problem in the derived 10-K quarter. A few P/Es above 300 (IVZ, GPC, CRL) need a look at their trailing net income.

**Cleanup PR (2026-11-10).** Branch `cleanup/phase1-edgar`, from the first look above, tested on fixture rows only (no keys, no database). Shares: a new `financials.shares_diluted` column (migration `0002`) is filled from the us-gaap `WeightedAverageNumberOfDilutedSharesOutstanding` frame, which most dual-class filers report with no class axis; `computeMetrics` now uses reported shares outstanding, else the latest quarter's diluted shares, else trailing net income ÷ trailing diluted EPS, and says which in `sharesSource` (marked on `/admin` next to the market cap). Dual listings: `onePerCompany` keeps one row per CIK for the market P/E, the sector bands and the `admin_check.ts` totals; per-ticker rows stay. Off-calendar years: a 10-K quarter is now derived only when the three reported quarters sit inside the annual row's own dates, run back to back and leave one quarter-sized hole at an edge of a twelve-month year; the derived quarter is named by the calendar quarter holding most of it (as EDGAR does), not by its end date; and a trailing sum needs four back-to-back quarters, so a missing quarter gives no number instead of a sum over fifteen months. The old rule could not subtract quarters from outside the year (it already checked the dates), so the May-year losses aren't fully explained yet; two real faults it did have are fixed (a "quarter" invented before the year began when the three weren't consecutive, and April years never getting their fourth quarter). The P/Es above 300 (IVZ, GPC, CRL) are December fiscal years, so this probably doesn't touch them; they look like one-off charges in trailing net income. What remains, for the next local session: rerun the backfill and `admin_check.ts` against Neon to see how many of the 41 now have a market cap and whether GIS, SJM and FDX still show losses (if they do, print their stored rows); Berkshire's EPS is per Class A share, so its estimated share count would be in A shares against a B-share price; the P/E outliers' quarters; joining price history across ticker changes (needs Massive's ticker-events endpoint). The first nightly run (2026-11-10 02:30 UTC) failed its prices step: Massive's free tier refused 2026-11-09 as "today's data before end of day".

**First nightly run failed on prices (2026-11-10).** The 02:30 UTC run (9:30 pm Eastern) got a 403 from Massive for Monday's closes: "Attempted to request today's data before end of day". The free plan doesn't serve a day's closes that same evening; the same call worked by 10:30 am Eastern. The other three steps ran clean. The cron moved to 11:00 UTC (6 am Eastern in winter, 7 am in summer), and a hand run that morning was clean: 504 closes for 2026-11-09, 2,412 financial rows, 73 calendar dates (79 the night before, as dates pass), and TransDigm's reported number, which the failed run couldn't match, resolved.

**Unlock time found; cron moved to 1 am Eastern (2026-11-11).** A probe asked Massive for Tuesday's closes every 15 minutes: refused at 11:54 pm Eastern, served at 12:09 am, so the free plan unlocks a day at about midnight Eastern (one night's reading). The first scheduled run at 11:00 UTC on 2026-11-11 was clean (504 closes for 2026-11-10, 2,416 financial rows, 75 calendar dates; Bio-Techne's reported number unresolved). Jeff moved the cron to 06:00 UTC (1 am Eastern in winter, 2 am in summer) so East Coast players wake up to the numbers.

**Cleanup PR checked against Neon and merged (2026-11-11).** The fixture tests passed but the real rows found four faults, each fixed with a test. McDonald's files its diluted share count as 708.3 (millions, without the scale), and that one fractional value failed the whole financials insert: fractional share counts are now dropped and fractional dollars rounded. Microsoft and 33 others lost their trailing numbers, because the job never fetched the current calendar year's annual frame, where fiscal years ending June to October are filed; main had been summing the wrong four quarters for them without saying so. The FedEx "loss" was its annual net income filed as 4,433 (meaning $4,433 million), which made year minus three quarters a loss of nearly $3 billion; Medtronic, Arista and PG&E file the same way, and a quarter is no longer derived from an annual figure a thousand times smaller than its quarters. PepsiCo and Domino's run a 16-week fourth quarter, which the new length check rejected. After the fixes: 495 of 500 companies have a market cap (462 tickers before; ERIE, BRK.B, V, VYLR and STZ still don't), 454 have a P/E (432), and the market P/E is 24.1 (24.3). Companies with January or October fiscal years (Nvidia, Walmart, Home Depot, Broadcom and about 40 more) had been skipping their fourth quarter; Nvidia's trailing net income moved from $176B to $193B. Smucker shows a P/E of 62, not a loss. General Mills' loss is real as filed (a reported quarter of minus $2.0B). The financials backfill was re-run from the branch, which filled `shares_diluted` and added the current-year annual rows for 40 companies.

**Found in that check, not fixed.** Fourteen companies show blank trailing numbers where main showed wrong ones: DOW, EIX, URI, CAH and FERG are each missing a reported quarter in the frames; FDX, MDT, ANET and PCG have the annual figure in millions; Exxon has a new CIK, so its history is split; AZO, COST, SKYD and HONA weren't examined. The diluted-share fallback is wrong for ECHO (a P/E of 1.5) and IBKR (about a quarter of net income ÷ EPS), and 23% off for News Corp. P/Es above 300 (Tesla, GPC, Palo Alto, Invesco, CrowdStrike) come from very small trailing earnings; whether to show them as "not meaningful" is a product call. Preview builds run `db:migrate` against the production database: this PR's migration was applied to Neon before anyone reviewed it (harmless here, one nullable column).

**Preview builds no longer migrate production (2026-11-11).** Every Vercel environment has the same `DATABASE_URL`, so a preview build ran `db:migrate` against the production database. Now only a production build migrates; a preview logs that it skipped. Previews still read and write production data when someone uses them (the `/admin` page can run a job step), so the full fix is a Neon branch per preview, which is a setting on the Neon integration in Vercel.

**Second clean night; earnings lookups a day early; P/E above 100 (2026-11-12).** The first run at 06:00 UTC was clean in 56 seconds: 504 closes for 2026-11-11, 2,456 financial rows (the per-period counts haven't moved since 2026-11-11, with 445 third-quarter filers), 75 calendar dates. The earnings step looked up three reported numbers and matched none. Applied Materials and Cisco were dated 2026-11-12, the day of the run: the job treated any date before tomorrow as due, so it asked before they could have reported and spent two of the 25 daily Alpha Vantage calls. It now looks up dates up to yesterday (`earningsLookupWindow`, with a test). Bio-Techne (dated 2026-11-11) has gone unmatched three runs in a row; not yet checked whether the calendar date is wrong or the data is late, and after seven days the job stops asking without saying so. Jeff decided the P/E question: trailing only, no forward P/E, and above 100 players see "over 100" with a coach question (decision log, concept doc). `/admin` shows "over 100 (312)". On these closes 22 of 454 companies are above 100: CRWD, IVZ, PANW, GPC, TSLA, CRL, LYV, DDOG, VTR, ED, MRK, P, ARES, AMD, BE, XYZ, PLTR, IFF, EL, OKTA, BIIB, WELL. Con Edison at 161 and Merck at 148 are worth checking against their filings before trusting them. The Alpha Vantage display-permission email is sent; no reply yet.

**The blank trailing numbers (2026-11-12, branch `phase1/blank-trailing-numbers`).** The 14 blank companies turned out to be about 60: 13 with no trailing revenue or profit at all and 47 missing one of the two (Amazon and Target had no trailing revenue). `scripts/company_rows.ts FDX MDT` prints a company's stored rows and computed quarters, which is how each cause was found. Six causes, each fixed with a test from the real rows:

- **Net income from the proxy statement.** PG&E, Medtronic, Arista, FedEx and Paychex showed annual net income in millions, Con Edison and Schwab in thousands. The figure comes from the proxy's pay-versus-performance table, which the frame returns when the 10-K uses a different tag. It is scaled up when EPS times diluted shares says so. Con Edison's P/E went from 161 to 19.3; Schwab's trailing profit from $1.8B to $10.6B. The first version of this check also multiplied a correct Waters loss by a thousand (Waters files its diluted shares a thousand times too big) and pushed the market P/E to 26.4; comparing main's code and the branch's on the same rows found it, and the check now touches only small annual figures.
- **A fourth quarter with one line missing.** Target's 10-K quarter has net income but no revenue; Caterpillar's, Allstate's and L3Harris's have revenue but no net income. The missing line is now the year minus the other three.
- **Two annual rows over one hole.** Amazon files a trailing-twelve-month net income (October to September) with no revenue; it was read first and left the derived fourth quarter without revenue.
- **Quarters the frames never had.** Costco and AutoZone run 12-week quarters, so two fiscal quarters share a calendar quarter and the frame keeps one; Costco's stored row had the second quarter's revenue and the third quarter's net income. Dow, Edison International and United Rentals have no second-quarter 2026 facts in the API although the 10-Qs were filed. A new step reads each blank company's own facts and stores the missing quarters, from the quarter's own fact or from a year-to-date figure minus the known quarters (decision log: "Quarters the frames leave out").
- **Exxon's new registrant.** Its history is under the old CIK; rows for it are now stored under the new one. P/E 16.7.
- **Tags we didn't ask for.** Booking's net income, and revenue for Best Buy, TJX, Kraft Heinz, CrowdStrike and the utilities.

After two full backfills and the new step: 493 of 500 companies have trailing profit (482 on main's code with the same rows), 467 have a P/E (454 this morning), 485 have both trailing revenue and profit, and the market P/E is 24.4. The financials step takes about 80 seconds a night with the new lookups (17 companies now), inside the function's 300.

**Still blank, and why (15).** Ferguson and FedEx changed their fiscal year, Skydance and Honeywell Aerospace have under a year of filings as they now exist, FDXF and VYLR have under four quarters: these fill in with time. Cardinal Health's March 2026 10-Q never reached the API and no year-to-date figure brackets it. Fifth Third, BNY, Truist, Synchrony and Regions are banks with no revenue concept (the open bank item). APA, Clorox and VMRK weren't examined.

**Found and not fixed.** Only 30 companies have trailing free cash flow: cash flow is filed year to date, so the frames have almost no quarterly figures. The new step derives them, but only for the companies it looks up; doing it for all 500 is the fix and matters if price to free cash flow goes beside the P/E. L3Harris's fourth-quarter row holds the full year's revenue ($21.9B), so its trailing revenue is $39.5B, not about $23B. Booking's trailing EPS (168) mixes pre-split and post-split quarters; its P/E is from net income and is fine. Merck's P/E of 148 is real as filed (two loss quarters in 2026). Waters now shows 471 for the same reason. Until this branch is merged, each nightly run on main puts the unscaled proxy figures and Costco's mixed row back.

**Still to do in this phase.** The five clean nights (two so far, 2026-11-11 and 2026-11-12); quarterly cash flow for every company; the open items from the cleanup check above plus the earlier list (banks with no gross profit, restated quarters, basic-only EPS filers); joining price history across ticker changes; the part-A reference numbers.

## Phase 2: accounts, clubs, the first 15 minutes (started 2026-11-12)

### Slice a: accounts and clubs (2026-11-12)

What a person can now do, start to finish:

- **Sign in** at `/sign-in` with Google or a 6-digit code by email. The email option only shows online once `RESEND_API_KEY` and `EMAIL_FROM` are set.
- **Agree** at `/welcome`, once: 13 or older, Terms, Privacy. Every player page sends you there first if you haven't.
- **Start a club** at `/clubs/new`: club name, your name and avatar, whether you play or only run it, the experience question, and the game rules (the usual ones filled in; the minimum hold can be set from 0 to 365 days).
- **Invite** from the club page: make a link, copy it, turn it off. A link works for 14 days.
- **Join** at `/join/<code>`: signed out it shows the club's name; signed in it asks name, avatar and experience.
- **Club page** at `/clubs/<id>`: who's in, the rules, your name and avatar. Organizers also get the invite link, the rule editor and "make organizer".
- **Terms** and **Privacy** at `/terms` and `/privacy`, plain and short.

Under it: tables `clubs`, `memberships`, `agreements`, `invites` and an `experience` column on the user (migration 0003); `web/src/clubs/` holds the logic and the who-sees-what rule (`access.ts`), with tests. The old status page moved to `/status`.

Checked by walking two invented people through the whole flow against the local app with real pages and form posts. Not yet looked at in a browser by eye, and not yet run online.

**Merged 2026-11-13** (PR #12); live on `owners-club-web.vercel.app`, migration `0003` applied by the production build. Jeff set the beta club's minimum hold at 14 days.

**Leaving and deleting (2026-11-13, branch `phase2/leave-and-delete`, not merged).** Leave a club, delete your account, and an organizer's "Remove" on the roster; the Privacy page now says how. No migration: the tables already cascade.

**Domain and email (2026-11-13).** The app lives at `https://playownersclub.com` (bought at Cloudflare, DNS there, records set to DNS only; `www` redirects to the apex). `BETTER_AUTH_URL` in production is that address, and the Google OAuth client has its callback. Resend is verified for the domain; `RESEND_API_KEY` and `EMAIL_FROM` are set, and Jeff has signed in both ways. The code email also carries a one-click "Sign in" button (same code, after the `#`).

Left over from this slice:

- The old address `owners-club-web.vercel.app` still serves pages, but Google sign-in from it fails (the app only calls itself `playownersclub.com`). Redirect it to the new address.
- Jeff is walking the test list: "Owners Club: what to test" (https://claude.ai/artifact/EfErJpBoCyHPcYTJfv1UtQ). Add each new slice's checks to that doc.
- Terms and Privacy were written by Claude; no lawyer has read them.

**Slice b groundwork (2026-11-13; nothing built yet).** What the real data looks like, for whoever ports the onboarding screens from `prototype/src/screens/onboarding/`:

- `companies.one_liner` is empty for all 503 members. Write the lines for the 24 theme companies in `content/themes.yaml` (all 24 are in the index, TTWO, SBUX and PEP included); others fall back to the GICS sub-industry.
- 177 companies have a sector lens; the other 326 get the company card without the "what matters" panel. Meta's lens is "Media and streaming", not "Software" as in the prototype.
- The `reference` table is empty. The market screen needs the top-10 share of the index, the count of US-listed companies, the S&P 500's share of the US market, the long-run index return and the public "1 in N" figure, each with a source (`docs/data_needs.md` part A).
- The prototype's lens panel showed made-up values (same-store sales, retention, backlog, subscribers). Only what `computeMetrics` returns is real: Rule of 40, margins, free cash flow, cash conversion, return on equity. Metrics we can't compute are named without a value.
- Earnings dates: 76 upcoming, all "estimated", through 2027-02-10. A company without a date says so instead of counting down.
- The market P/E is computed on the admin page (`sumPe`); the prototype hard-codes 23.
- New tables this slice needs: `orders`, `theses`, `conversations` and `messages` (the scripted coach writes every turn, so a refresh resumes), per the data model in `docs/build_plan.md`. Orders are saved as waiting; slice c fills them.
- Scripts that import `scripts/env` talk to the production database (`.env.local` holds its URL); `npm run dev` uses an empty local one. Local screens need market data copied in or a seed.

### Slice b: the first 15 minutes, up to a placed order (2026-11-13; merged 2026-11-14 as PR #15)

What a player can now do, start to finish, on real companies and real numbers:

- **You already own the market** at `/clubs/<id>/start`: the $10,000 in the index, the 100 squares with the 10 biggest companies in gold, the two fold-out explainers, who's playing. New joiners land here straight from the invite link.
- **Start from curiosity** at `/clubs/<id>/pick`: search all 503 members by name, ticker or what they're known for ("youtube" finds Alphabet), or open one of the five themes. SpaceX, OpenAI and Anthropic lead to the private-company lesson. Clubmates' theses show under "Why your clubmates bought" once there are any.
- **The company card** at `/clubs/<id>/company/<ticker>`: last close and about a year of prices, market cap, P/E, trailing revenue and profit, "What buyers expect" against the whole index and the company's kind, the sector lens, the next earnings date. Every term opens its plain explanation.
- **The coach** at `.../coach`: the prototype's script, run on the server with the company's real numbers, saved one message at a time. Close the page mid-conversation and it picks up where it was.
- **The thesis** at `.../thesis`: three parts in the player's own words and one prediction, compared with last quarter's real number.
- **How much?** at `.../size`: the slider, with this club's cap, fee and hold.
- **Done** at `/clubs/<id>/orders/<order>`: Shareholder on the first pick, the countdown to earnings, the thesis. The club page lists "Your picks".

Orders are saved as **waiting**. Nothing fills them yet: that is slice c.

Under it: tables `orders`, `theses`, `conversations` and `messages` (migration 0004). `web/src/market/read.ts` is what screens read from the cache (a company with its computed numbers; index-wide numbers computed once per new close and kept in memory). `web/src/coach/` holds the script and the stored conversations. `web/src/game/picks.ts` holds the thesis and order rules, checked on the server whatever the screen allowed: a written thesis, the club's cap counting what is already in that company, no more than is left in the index, only current members, only people who play. A refused order is logged as `trade.rejected` without the player's words. The game screens use the prototype's stylesheet, scoped under `.game` so the account and club pages keep theirs.

**What changed from the prototype, because the data is real.**

- **Numbers a screen can't back are gone.** The lens panel shows a value only where filings give one (gross and operating margin, Rule of 40, free cash flow, cash conversion, return on equity, debt) and says "we don't have this number yet" for the rest (same-store sales, subscribers, backlog, retention). Free cash flow is blank for most companies until quarterly cash flow is derived for all 500 (phase 1's open item).
- **The market's own numbers are computed.** The market P/E (22 to 24 on recent closes, where the prototype said 23), each kind's usual P/E range (the middle half of its members, falling back to the rough range in `sector_lenses.yaml` under eight members) and the top-10 share of the index (42% on the local data) come from the stored rows.
- **The looked-up facts have sources**, in `content/market_facts.yaml`: about 3,900 US-listed companies (World Bank, 2025), half the 1996 count, the S&P 500 at about 80% of the US market, about 10% a year since 1957. **One changed: "about 1 in 8" large companies are public is now "about 1 in 5".** Apollo's count moved from 87% private (April 2024) to 81% (February 2026). I read that figure from a search summary of Apollo's chart book, not the PDF itself; Jeff accepted "about 1 in 5" on 2026-11-14.
- **P/E over 100** shows "over 100", the scale pinned at "100+", and the last four quarters' profit, so the player can see whether it was one bad quarter. The coach asks which.
- **No P/E** has three different honest reasons: a loss, under a year of reports, or no share count (Berkshire, Visa and three more).
- **Time words.** "Last year" became "over the last 12 months"; the prediction is compared with "last quarter", using the latest quarter against the same quarter a year before.
- **The club's own rules.** The size screen quotes this club's cap, fee and hold (the beta's 14 days reads "this club set a shorter wait than the usual 3 months").
- **The coach no longer calls a P/E near the market's "a lot of growth".** The script now has three cases (well above, about the same, well below a typical company), the same bands the company card uses. The prototype had two.
- **"Start from my answers"** no longer glues the company's name onto a short answer ("Nvidia I use their stuff.").
- **Names.** 24 companies have a hand-written name and line (`content/company_lines.yaml`); the rest show the member list's name, tidied ("Nike, Inc." to "Nike"), and their industry.

**Left out of this slice, on purpose.**

- **Concept progress.** The coach's marks, the check question in a term's sheet, "You used: P/E" on the done screen and the toasts all need `concept_progress` and the tagger (phases 4 and 6). A term's sheet shows the explanation, what's normal and an example. Shareholder is shown on the first order because that is its whole rule.
- **Scouting reports** ("Scout it" on a company card) and turning one into a pick: Learn tab, phase 6.
- **The mock microphone**, the ✎ feedback button (phase 3) and the mini leaderboard on the market screen (no returns until orders fill).
- **The organizer's view of players' picks.** A non-playing organizer still sees only the roster.

**Added 2026-11-14: cancelling a waiting order.** Jeff's call: yes. The done screen has "Cancel this order" (two taps) while the order waits. Cancelling costs nothing, because nothing was bought: the money counts as back in the index, the thesis becomes a draft again, the coach conversation reopens, clubmates stop seeing the thesis, and the order shows as cancelled on the club page. A cancelled order doesn't count as a first pick. The rule is in `docs/concept.md`.

**Checked.** 132 tests pass, with three new files (the script across every kind of company and player, including a check that no line recommends; conversations resuming; every pick rule; the read layer on fixture rows). Walked in a browser against the local app as one invented player: club, market screen, search, themes, Nvidia's card, the coach with a reload in the middle, thesis, size, order, the club page, a second visit to the coach (a new conversation), Tesla (P/E over 100), Berkshire (no share count), SpaceX.

**Not checked.** Nothing has run online: a preview build can't, because previews share the production database and don't apply migrations, so the four new tables don't exist until this is merged and a production build runs. Not looked at on a phone. Earnings countdowns were only seen in tests (the local database has no earnings dates). A production build (`next build`) passes on the Mac mini; it fetches the display font from Google at build time, which hasn't been tried on Vercel.

**Local data.** The local database is loaded from the public sources, not copied from production: with `npm run dev` running, `DATABASE_URL='postgres://postgres:postgres@127.0.0.1:54331/postgres?sslmode=disable' npx tsx scripts/backfill.ts sp500`, then `financials` (about four minutes), then `prices --from 2025-10-20 --days 400` (about an hour at the free tier's pace; a few weeks is enough to see the screens). Skip `earnings` locally: it spends the same 25 Alpha Vantage calls a day the nightly job needs.

**Found, for other phases.**

- Apple has no lens (GICS files it under "Technology Hardware, Storage & Peripherals"); the prototype showed it as a consumer brand.
- Orders placed before slice c ships are tests (Jeff, 2026-11-14: nobody is invited until fills work). Slice c clears them, with their theses and conversations, before its first fill run; it does not fill them.
- Two buys sent at the same instant are each checked against the cap before either is saved, so together they could pass it. Slice c's fill step should re-check the cap, which closes this.
- A company removed from the index stops being reachable (`companyView` returns only current members); held positions in a removed company need a path in phase 3.

### Slice c: orders fill at the close (2026-11-14, branch `phase2/fills`)

**What a player gets.** A pick placed before 4 pm in New York goes through at that day's closing price; later, or on a weekend, at the next day the market is open. The next morning the order page shows what happened, line by line: what moved out of the index fund, the fee, any tax, and how many shares went in at what price. The club page says "bought" with the date, and the company page says what the player owns.

**How it works.**

- **The nightly job has a new step, `fills`,** right after the closes are stored (`web/src/game/fills.ts`). It opens portfolios, then fills waiting orders oldest first. Running it twice changes nothing.
- **A portfolio opens at the first close after the player joined:** $10,000 of the index fund (SPY's close stands in for the S&P 500) becomes the first row in the new `lots` table. Until then the player has "$10,000 in the index" with no price behind it.
- **A buy is one trade:** dollars leave the index, oldest index money first; the fee (0.5% of the amount) and the tax on whatever that index money had gained come out; the rest buys shares, to a fraction of a share. Each purchase is its own lot with its date, which is what the hold period and the 6-month tax line will read.
- **Tax is paid when a gain becomes real,** against everything the player has made real so far, so a loss offsets earlier gains (tax comes back) and an early loss carries forward. The running totals are sums over the player's filled orders; there is no separate tax table.
- **An order that no longer fits is trimmed, not refused.** The cap is checked again at the close against what the portfolio is worth then. If the market moved and $2,500 is now over a quarter, the order moves what fits and says so. It is refused only when nothing fits, or the company left the index in between; then the thesis goes back to a draft.
- **Cancelling stops at the close.** Once 4 pm New York has passed on the order's day, it can't be cancelled, even though the job runs hours later. Otherwise a player could look at the closing price and then decide.
- **The buying limits now use real values:** the cap is a quarter of what the portfolio is worth at the last close, and "left in your index fund" is what the index holding is worth, less orders still waiting.
- **Migration `0005`** adds `lots` and the fill details on `orders`, and clears the test orders, theses and coach conversations placed before fills existed (Jeff, 2026-11-14).

**Rules decided.** Jeff approved the four rules a player can see on 2026-11-15, as built: fee and tax come out of the amount moved; the $10,000 enters the index at the first close after joining; an over-cap order is trimmed with a note; no cancelling after 4 pm New York on the order's day. The size screen gained a line saying tax on index gains comes out of the amount too, not only the fee.

**Not in this slice.** Selling (the arithmetic for selling lots and taxing the gain is written and tested, because a buy sells index money; there is no sell button). The portfolio page, the board and daily valuations (`portfolio_days`): phase 3. Dividends: neither picks nor the index fund collect them, so the comparison stays fair but both run a little under real life.

**Known gaps.**

- Market holidays aren't known ahead of time, so on a holiday (Thanksgiving, say) an order placed that day locks at 4 pm but fills at the next open day's close. Jeff, 2026-11-15: known quirk, no fix for now. The order page names the next weekday and adds "or the next day the market is open"; the fill step waits for a day that has closes. Days the market closes early (1 pm) are treated as 4 pm.
- A company with no close on a day the market was open (a trading halt) waits for its next close.
- Two runs of the job at the same moment could both read a player's lots before either writes. The cron runs once a night and a hand run is one click, so this is left alone; each order still fills only once.

## Phase 3: portfolio, board, feed (started 2026-11-15)

### Slice a: the portfolio page and selling (2026-11-15, branch `phase3/portfolio_and_selling`)

Jeff's call (2026-11-15): portfolio and selling first, the board and the feed after. He is testing alone before anyone else is invited.

**What a player gets.**

- **Portfolio** (`/clubs/[id]/portfolio`, linked from the club page): what it's worth at the last close, the tax if it were all sold, the after-tax value; that return beside the same $10,000 left in the index; fees and taxes paid; every holding with its share of the whole, its gain, the tax selling it would cost, when it unlocks and when its tax rate drops; orders waiting for the close; a chart of how the mix has changed day by day; the list of trades.
- **Selling** (`/clubs/[id]/company/[ticker]/sell`, from the "Sell?" button on an unlocked holding): a slider in dollars at the last close, the lines of what the sale would cost (fee, tax or tax back, what goes into the index), and the "sell now vs. wait" pair when waiting for the 6-month line would lower the tax. The order waits for the close like a buy, can be cancelled until then, and its page shows the real lines afterwards.

**How it works.**

- **A sell is placed in shares.** The dollars on the slider become shares at the last close; the close decides what they bring in.
- **Oldest shares first, and only shares past the hold.** A holding bought in two goes can be partly locked; the screen says how much and until when.
- **The money goes back to the index** as a new lot dated that day, after the fee and the tax.
- **Buys and sells fill together, oldest order first.**
- **One row a day per player** (`portfolio_days`, migration `0006`), written at the end of the fills step from the same function the page uses.

**Not in this slice.** The board, clubmates' portfolios, the feed. On the portfolio page: the weighted P/E line on the drift chart, "what drove each gain", per-holding price charts, and the coach's prompt when a hold ends. A coach conversation before selling (the prototype had one) waits for the live coach in phase 4.

**Known gaps.**

- The drift chart starts the night this ships; it has no days before that, and a night the job misses leaves a gap.
- The hold is counted in calendar days from the day a pick filled, so a pick can unlock on a weekend and be sold at Monday's close.
- "After tax" doesn't subtract the 0.5% fee a full sale would cost.

**Jeff's answers (2026-11-15; branch `phase3/sell_reason`).** Selling asks "Why are you selling?" and takes one line, never judged (`orders.reason`, shown on the order page). Shares and oldest-first stay; no choosing lots. The compared number is now "what you'd keep": after the tax and the 0.5% fee a full sale would cost, for the player and for the untouched index; the portfolio page shows worth, tax, fee and what you'd keep (`feeToSell` and `kept` in `portfolioOf`; `kept` and `index_kept` on `portfolio_days`, migration 0007, adds three columns and deletes nothing). The board is next; the feed is the least important.

### Slice b: the board and clubmates' portfolios (2026-11-15, branch `phase3/board`)

Jeff's call (2026-11-15): the board next; the feed is the least important.

**What a player gets.**

- **The board** (`/clubs/[id]/board`, linked from the club page and the portfolio page): every player's lead over the S&P 500 in percentage points, with their own return and the market's under it; the index as a line at zero; under each name the number of picks, the biggest pick's share and how long they've played. Chips switch between "since each start", 3, 6 and 12 months; a window opens when one player has played that long. Players without a portfolio yet, or without the whole window, are listed below.
- **The Bell**: a card under the board saying who leads the 6-month board, or the first date anyone can.
- **A clubmate's page** (`/clubs/[id]/players/[memberId]`, from a board row): their mix as shares of the whole, from the newest day at least a week old, or the date their first day will show. An organizer who doesn't play sees the latest day with dollars.

**How it works.** Everything is read from `portfolio_days` (`web/src/game/board.ts`); no migration. Tests: `web/tests/board.test.ts`.

**Checked** on the local app with three invented clubmates: the board since start, the "not on this board yet" list, the Bell card, a clubmate's week-old mix and the "shows up on" message. Only in tests: the 3- and 6-month boards and the Bell holder (nobody has the history), and the organizer's view.

**Known gaps.** The board shows a clubmate's pick count and biggest share as of last night while their page is a week old, and theses already name companies the day they're written; Jeff to say whether that is the intended line. No 9-month window, no risk-adjusted or predictions board, no weighted P/E. The weekly recap that announces the Bell is phase 5 work.

**Jeff's answers on slice b (2026-11-15).** "Since each start" stays: a club can't wait three months for a comparison. The sell reason stays private to the seller. Two things he raised and hasn't decided: a club "opening day" (join before it and start together; late joiners get an index purchase backdated to it; maybe annual seasons), and showing clubmates' holdings in real time, since the week's delay exists only to stop copying. Order of work from here: Jeff walks the test doc, then the feed (basic), then the live coach last.

**The week's delay is gone (2026-11-15, branch `phase3/live_holdings`).** Jeff: drop it. A clubmate's page now shows their mix at the last close, as shares, with dollars still private to the player and a non-playing organizer. The concept's "Delayed positions" rule, the Privacy page and the start-a-club form say so. The feed's first version is agreed: a card when a clubmate places a pick (thesis and prediction), a line when a buy or sell goes through (company only), and comments on a thesis.

### Slice c: the club's opening day (2026-11-15, branch `phase3/opening_day`)

Jeff's call: late joiners get their $10,000 backdated to the club's opening day; an organizer can set a future opening day; no trades before it; the test club opens Monday 2026-11-16.

- **Starting a club** asks for an optional opening day. Empty means the next market close.
- **Before it**: the club page, portfolio page and size screen say when the club opens; a pick can't be placed (the thesis is kept); the organizer can move the day.
- **At its close**: every player's $10,000 goes into the index.
- **Joining later**: the portfolio opens at once, dated the opening day, and the portfolio page says so. The board measures everyone "since opening"; trailing boards open for the whole club together.

Migration 0008 adds `clubs.opens_on` and sets it to 2026-11-16 for every club that already exists (it changes that one new column; nothing is deleted). Tests: `web/tests/opening.test.ts`. Checked locally: the migration on a database with clubs in it, the club page before opening, the new field on the start-a-club form. Only in tests: a late joiner's portfolio and the moved opening day.

**Not built:** annual seasons. A waiting sell placed before opening can't exist (nothing to sell), so only buys are gated.


### From Jeff's test pass (2026-11-21)

- **Even and shares (PR #35).** Only a real tie reads "Even"; a fee-sized gap shows as −0.05% and sits below the board's line. The order page says "about 0.90 shares". Fixes #34.
- **Sliders (PR #36).** The buy and sell sliders reach their exact top again. Fixes #33.
- **Fills by hand don't come sooner.** Massive's free plan serves a day's closes from midnight New York, so running `fills` on /admin in the afternoon finds nothing new. The test doc said otherwise and now doesn't.

### Slice d: dividends (2026-11-21, branch `phase3/dividends`)

Jeff moved dividends up: they must work before the adult pilot club. His rules: credit on the ex-dividend date; tax at the long-term rate; the player chooses index fund or more of the same company; the index fund's own dividends reinvest, in the comparison too; back-credit the beta club's Costco special ($30, ex 2026-11-24).

- **What a player sees.** On the buy screen, a company that pays dividends gets a card: what it paid over the last year, as a share of the price and per $1,000, any special or announced one, how the game pays it, and a choice of where it goes. The company page shows the same for a company they own, with Save. The portfolio lists each dividend (per share, shares, tax, where it went), and "Taxes paid" says how much was on dividends. "Dividend" is a tappable term (the `dividends` concept).
- **How it works.** The nightly `dividends` step stores the market's last ten days; the fill step credits before orders fill. Details in the decision log's Dividends row. Migration 0009 adds `dividends`, `dividend_credits`, `dividend_choices`, `lots.credit_id` and `companies.dividends_checked_on` (new tables and columns only).
- **Checked.** Tests (`web/tests/dividends.test.ts`): the arithmetic, crediting into the index and into the company, shares bought on the ex-date not paid, running twice, no hold on dividend shares, and an all-index player staying exactly even with the comparison when SPY pays. Live against Massive: a week of the market (1,820 rows, three pages) and Costco's year. On the local app: the buy screen card and choice, the choice saved with the order, the company page's Save, the portfolio's list.
- **Not yet.** The first dividend doesn't mark the `dividends` concept as learned by experience (that waits for the ranks work). No dividend line on a clubmate's page or in the feed.
- **Costco.** The beta club's Costco special is credited by the nightly run early on 2026-11-25 (Wednesday), the first run with the 2026-11-24 close.
