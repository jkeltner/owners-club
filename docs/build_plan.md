# Real build plan

Jeff Keltner · drafted by Claude Code, 2026-11-08 · status: **decided** (accounts, models and the prototype fix on 2026-11-08; database, order, the adult pilot and hosting on 2026-11-09; record at the end)

The prototype did its job: seven playtest rounds, five outside testers, the rules settled. This is the plan for the version with real accounts, a database, real market data and the live coach. It is the build-facing successor to [the prototype brief](prototype_brief.md). Game rules stay in [the concept doc](concept.md); technical decisions land in [the build spec's decision log](build_spec.md#decision-log) as they're made.

## Goal

A pilot that one club of real kids can play for a school year: someone creates the club, players join from an invite link on their phones, picks fill at real closing prices, the coach is Claude, and the leaderboard updates every night. Everything in the concept doc's "How the game works" table, measured against the real S&P 500.

**Not the goal yet:** many clubs, a native app, a public sign-up page, payments. The data layer and accounts are built so those can come later without a rewrite.

## What we're keeping from the prototype

The brief said to expect to throw most of the prototype away. Some of it has earned its keep:

- **All of `content/`** (concepts, lessons, scenarios, lenses, themes, glossary). It loads into the database on each deploy, as the build spec already says.
- **The pure game logic in `prototype/src/lib/`**: `rules.ts` (fees, taxes, cap, hold), `ranks.ts`, `showdown.ts`, `weekly_replay.ts`. These move into the new app as the server-side rules engine and get unit tests, which they don't have today.
- **The coach interface** `askCoach(context, input) → {bubbles, chips, tickers, done, marks}` and the seven modes. The live coach keeps this shape; the scripted version stays as the offline fallback and the test double.
- **The screens, as design.** Copy, layout and flow were playtested; the components get ported to the new app rather than rewritten from scratch, but each one is re-wired to server data as it's ported.

What goes: `prototype/src/data/` (every fake number), the localStorage store, and the GitHub-issue feedback function (replaced by the same thing inside the new app).

## Stack

Decided 2026-11-09, with the reasons. The Neon-or-Supabase comparison that settled the database row is kept at the end for the record.

| Piece | Proposal | Why |
| --- | --- | --- |
| Framework | **Next.js (App Router) on Vercel**, one app in `web/`. Server Actions and route handlers for the API; no separate backend service. | The deployed, working pattern from Deep Thoughts, so the setup, the gotchas and the tooling are already known. One deploy, one repo. The prototype's React components port with little change. |
| Database | **Neon Postgres** through the Vercel Marketplace, **Drizzle ORM** for the schema and migrations (decided 2026-11-09 over Supabase). | Same as Deep Thoughts. Marketplace install provisions the database and the environment variables in one step. Postgres covers lots, theses, progress records and the market-data cache with plain tables; no second datastore. Local dev uses PGlite over a socket, as Deep Thoughts does. |
| Sign-in | **Google sign-in and email one-time codes, no passwords** (decided 2026-11-08). Players join through an invite link (see Accounts below). Library: Better Auth, with Resend through the Marketplace sending the codes. | Open source and self-hosted suits an MIT project other people may run: no per-user pricing, no third-party sign-in page. Better Auth is already proven on Deep Thoughts. Clerk considered and dropped: a paid, hosted dependency in every self-hosted copy. |
| Club chat | Polling (on focus and every 30 s) in the pilot; no realtime layer. | The game updates once a day on purpose; chat is secondary. A realtime layer would be a second stack to run. Revisit if the pilot shows kids actually chatting in the app. |
| Scheduled jobs | **Vercel Cron**: one nightly job after the close (prices, fills, portfolios, leaderboard, earnings checks) and one weekly job (recap, club replay, new listings). Each job is idempotent and re-runnable by hand. | Matches the game's once-a-day rhythm. On Pro the crons can run on any schedule, so the nightly job can be re-run and earnings checks can run on report days without a hand run. No queue until something needs retries; Deep Thoughts made the same call. |
| AI | **Anthropic SDK direct.** Coach and weekly recap on `claude-opus-5-5`; concept tagger on `claude-haiku-5-5` (decided 2026-11-08, with cost tracking from day one so the coach model can be revisited; see "Tracking AI cost" below). Model ids are environment variables. | One vendor for all three jobs, as the build spec proposes. Opus for the conversations because the coaching quality is the product; Haiku for the tagger because it's a classification call on every thesis. Rough cost: a three-question coach conversation is about 10K input and under 1K output tokens, roughly 5¢ before caching; a club of eight kids making two picks a week is a couple of dollars a month. Server-side refusal fallback on, since kids type unpredictable things. |
| Market data | As decided in the build spec: SEC EDGAR bulk fundamentals, Massive free tier for daily closes, Alpha Vantage for earnings dates, news and long history. Each behind its own adapter; the app reads only our tables. | Unchanged. **Display permission for prices is the long pole**: email Alpha Vantage this week, before any code, because the answer may take weeks and decides whether Intrinio is needed. |
| Hosting | Vercel project `owners-club-web` in Jeff's Projects (the team Deep Thoughts is in; Jeff is upgrading it to Pro), root directory `web/`, preview deploys per branch, production from `main`. The prototype's project keeps the name `owners-club` and serves owners-club-alpha.vercel.app unchanged until the real app replaces it; the projects swap names when the prototype retires. | Pro from day one (decided 2026-11-09): no non-commercial ambiguity, crons on any schedule, password-protected previews once test accounts exist, longer log retention. One team for Jeff's projects; the Solar Car Club's Pro team was considered and dropped the same day. Testers keep a stable prototype while the real app is built. |
| Monitoring | An `app_events` table (server errors, failed jobs, model errors, rejected trades) read by a daily Claude routine that emails Jeff only when something's wrong. | Deep Thoughts' pattern, already tuned. No dashboard to build. |
| Secrets | Vercel environment variables, pulled to `.env.local` with `vercel env pull`. Nothing in the repo. `.env.example` lists the names. | Repo is public. |

## Accounts and clubs

The build spec's open question, settled 2026-11-08 (sign-in method) with the rest proposed:

- **Anyone 13 or older creates a club** and becomes its organizer (revised 2026-11-12: we can't verify an adult, and a school club should be able to start itself). Club settings (fee, tax rates, hold, cap) are the organizers' to change, with the concept doc's defaults. An organizer can play or only watch (a teacher); a club can have more than one.
- **Organizers who don't play see the whole club:** every player's holdings, trades, theses, returns and concept progress, in dollars and live. An organizer who also plays sees what any player sees, so they can't copy trades. Coach conversations stay private to the player.
- **Kids join from an invite link** (a code in the URL, expiring, revocable). On joining they pick a display name and avatar, sign in with Google or an email code (decided: no passwords, no phone sign-in in the pilot), and answer the experience question. No birthdate is asked. Sign-up shows "By clicking Agree you confirm you are 13 or older and accept the Terms and Privacy Policy", and stores when and which version. The terms say the money is pretend and the coach is an AI. An account found to belong to someone under 13 is removed with its data.
- **Each person is in one club in the pilot's screens, but the schema is built for many.** A membership (one person in one club) is the player: every portfolio table hangs off it, so two clubs mean two separate $10,000 portfolios. Concept progress and rank belong to the person and carry across clubs.
- **Access rule, enforced in every query:** a player sees only their own club. Clubmates' holdings are visible to other players as shares of the whole, a week late, exactly as the concept doc says; dollars are seen only by the player and the club's non-playing organizers.
- **Parent nugget is left alone for now** (Jeff, 2026-11-12): unbuilt, and no parent account is assumed.
- **Data kept to a minimum:** name, email (or Google id), avatar, experience, club. Coach conversations are kept for the season and deleted after it unless the retention question is answered differently.

## Data model

The build spec's data model, made concrete. Table names are proposals.

**App-owned**

| Table | Holds |
| --- | --- |
| `users`, `sessions`, `accounts` | Better Auth's tables; the experience answer lives on the user |
| `clubs` | name, created by, settings (fee, short/long tax, hold months, cap %), season start |
| `memberships` | user ↔ club, display name, avatar, joined at, role (organizer / member), plays (yes / no). **This is "the player" in every table below marked membership.** |
| `agreements` | user, terms version, agreed at (the 13-or-older and terms click) |
| `invites` | club, code, created by, expires, used by |
| `orders` | membership, ticker (or `SPX` for the index), side, amount in dollars, placed at, fill date, fill price, fee, status |
| `lots` | membership, ticker, shares, cost basis, bought at (from a filled order); what makes hold periods and the 6-month tax line computable |
| `theses` | membership, ticker, three parts (does well / happens next / number watched), prediction (metric, value, unit), kind (pick / scouting report), linked order, created at; scored at earnings |
| `thesis_results` | thesis, earnings date, reported value, hit or miss, coach debrief id |
| `conversations`, `messages` | coach conversations by mode, membership, ticker, thesis; readable only by that player; **every turn written as it happens** (issue #5: a refresh must resume mid-conversation) |
| `concept_progress` | user (the person, not the membership: learning carries across clubs), concept slug, encountered / explained / applied timestamps, evidence (message or thesis id) |
| `comments`, `votes` | feed comments on theses; showdown votes (membership, thesis, holds / breaks, hidden until the report) |
| `club_weeks` | per club per week: recap text, replay slug and reason, Bell holder, generated at |
| `portfolio_days` | per membership per day: total value, after-tax value, unrealized tax, fees and taxes paid to date, largest position %, holdings count, weighted P/E; what the leaderboard and the drift chart read |
| `app_events` | monitoring |

**Market-data cache** (written only by jobs)

| Table | Holds |
| --- | --- |
| `companies` | the S&P 500 members: ticker, name, sector, our lens, plain "what it does" text, status |
| `prices` | ticker, date, close (index ETF included) |
| `financials` | ticker, period end, revenue, net income, EPS, shares, gross profit, operating income, cash flow lines, debt, cash, equity (EDGAR) |
| `earnings_dates` | ticker, date, confirmed or estimated, reported values once in |
| `headlines` | ticker, date, title, source URL |
| `reference` | the part-A numbers from `data_needs.md` (index return, SPIVA share, top-10 share…), with a source and a fetched-at |

Computed numbers (P/E, margins, growth, market cap) are functions over these tables, not columns, so they can't drift from their inputs.

**Content** (loaded from `content/` on deploy): `concepts`, `lessons`, `scenarios` (with their precomputed price series), `lenses`, `themes`, `glossary`.

## The coach, for real

`askCoach` becomes a server action that:

1. Loads the player (experience, progress), the company (computed numbers), the one to three concepts this moment touches (by trigger events in `concepts.yaml` and the player's progress), and the conversation so far.
2. Calls the model with a system prompt that carries the product rules verbatim (asks questions and shows numbers; never says a stock is good or bad, never says what to buy, never blocks a trade; plain language for a 14-year-old; only point at numbers the player can see) and the concept records' teaching notes and misconceptions.
3. Asks for structured output in the `CoachReply` shape (bubbles, chips, tickers, done, marks), so the screens don't change.
4. Writes the turn to `messages` before returning it.
5. Runs a cheap check on the reply: if it names a stock as good or bad or tells the player what to do, regenerate once, then fall back to a neutral question. This is the guard behind "the coach never recommends".

After `done`, the tagger (Haiku) reads the conversation or the thesis and writes `concept_progress`, with the rule from the concept doc: a conversation or check question can mark explained; only a thesis or scouting report marks applied.

Prompts live in `web/src/coach/prompts/` as files, versioned, with a small eval set built from the playtest transcripts (what the scripted coach said, and the lines testers liked) before the live coach replaces the script.

### Tracking AI cost

Jeff's condition on Opus (2026-11-08): know what it costs, and be able to switch. So, from the first live call:

- **Every model call writes a row to `ai_calls`:** when, which job (coach, recap, tagger), mode, model, player and club ids, input tokens, output tokens, cache-read and cache-write tokens, latency, stop reason, and an estimated cost computed from a price table in code (per-model prices, versioned, so a price change doesn't rewrite history). The API's `usage` object has every number; nothing is estimated except the dollar figure.
- **The weekly monitoring email gets a cost line:** spend this week and this season, split by job and by model; cost per coach conversation and per club per week; the ten most expensive conversations. The same query is a small internal page.
- **Prompt caching on by default:** the system prompt, product rules and concept records are a stable prefix, so the per-conversation input cost drops to cache-read rates after the first call of the day. `ai_calls` shows the cache hit rate, which is the first thing to check if cost looks high.
- **The switch is a config change,** per job: `COACH_MODEL`, `RECAP_MODEL`, `TAGGER_MODEL`. After phase 4, the eval set (real playtest conversations) is run on `claude-sonnet-5-5` and compared with Opus on the same inputs; if Jeff can't tell them apart, the coach moves to Sonnet and the recap can stay on Opus (one call per club per week). A per-club setting is also possible if some clubs warrant the stronger model.
- **A hard ceiling:** a daily spend cap in config; past it, the coach falls back to the scripted version and the monitoring email says so. Protects against a loop or a kid who finds the chat fun.

## Phases

Each phase ends with something Jeff can click on a preview URL, and a short note in `docs/build_log.md` (what shipped, what changed in the plan). Order chosen so the risky, slow things start first.

**Phase 0: kickoff (this week)**

- Email Alpha Vantage about display permission under educational access. Start the clock.
- Scaffold `web/`: Next.js, Drizzle, Better Auth, Neon via Marketplace, PGlite locally, `.env.example`, the Vercel project, a hello-world deploy. Port `content/` loading and the `lib/` rules with their first tests.
- Decision log rows for everything in the stack table.

**Phase 1: market data layer (about a week)**

- Adapters and nightly job: S&P 500 member list, Massive daily closes (plus the index ETF), EDGAR quarterly financials, Alpha Vantage earnings dates and headlines. Backfill 5 years of prices and the financials EDGAR has.
- Computed metrics as tested functions; the sector P/E bands and the S&P 500 P/E from part A of `data_needs.md`.
- A plain internal page listing every company with its numbers, to eyeball against a finance site. This is where the EDGAR cleanup (banks with no gross profit, fiscal-year offsets, restated quarters) gets found.
- No kid-facing UI yet. Done when the nightly job has run clean for five days. (Jeff, 2026-11-09: this shouldn't take two weeks. The code is a week; the five clean nights overlap with phase 2.)

**Phase 2: accounts, clubs, the first 15 minutes (2 weeks)**

- Anyone creates a club and is its organizer; invite link; player joins (Google or email code); the Agree click (13 or older, terms, privacy); experience question; profile. Plain Terms and Privacy pages. The organizer's view of the club.
- Port the onboarding flow against real companies and numbers: market screen, curiosity, company card, private-company path, scripted coach (still the script), three-part thesis, size the pick, done.
- Orders fill at the next close by the nightly job; lots, fees, the cap and hold enforced server-side.
- Done when Jeff and one kid can each join a test club from a phone and make a real pick that fills the next evening.

**Phase 3: portfolio, leaderboard, feed (2 weeks)**

- Nightly `portfolio_days`; portfolio screen with after-tax value, drift chart, gain split; sell flow with the sell-now-vs-wait card and the 3-month lock.
- Leaderboard (main, rookie, long-term, risk-adjusted, predictions) from `portfolio_days`; clubmate portfolios a week late; the Bell.
- Feed: theses, comments, the "this week on the market" card from real earnings dates. Feedback ✎ button filing issues as before.
- Done when a club of test accounts has run for a week and the board matches a spreadsheet.

**Phase 4: the live coach (2 weeks)**

- `askCoach` on Claude for pick, private, scout and sell modes; tagger; conversations persisted turn by turn; the never-recommends guard; the eval set.
- Earnings-day job: compare predictions to reported numbers, write results, generate the debrief conversation, resolve showdown votes.
- Done when ten real conversations read well to Jeff and the tagger's marks match his by hand on a sample.

**Phase 5: adult pilot club (starts when phase 4 ships; runs 4 to 6 weeks)**

Jeff's addition (2026-11-09): before any kid plays, a club of adults plays the game exactly as kids would, and the kids' pilot follows only if it goes well.

- No adult mode. Adults get the same invite link, experience question, picks with theses, live coach, nightly fills and board. Jeff owns the club; four to eight adults who will actually make picks for a month.
- What it's for: finding what breaks over weeks of real play with people who can describe it. Nightly job reliability, fills and the board math, the coach on unscripted conversations, the cost line per player per week, the never-recommends guard's catches.
- What it isn't for: whether the copy is pitched right for a 14-year-old. Adults will say it's too simple; that note is discounted, the kids' pilot answers it.
- The ✎ button files GitHub issues as on the prototype and the daily review keeps reading them. Rounds are logged in `docs/playtests/` like the prototype's.
- Phase 6 ships into this club as it lands.
- Done when the club has run four weeks without a hand-fixed night, every guard catch has been read, and the cost per player per week is known. Then Jeff decides on the first kids' club.

**Phase 6: Learn tab, recap, showdowns, replay (2 weeks, into the adult club)**

- Lessons and scouting from Learn; time machine replays on stored real history (the scenarios' series fetched once); ranks computed from `concept_progress`.
- Weekly job: recap (Claude) with the Bell and one concept, the club replay chosen by `weekly_replay.ts`, new listings card.
- Showdown voting and result cards.

**Phase 7: pilot readiness and the first kids' club**

- Price display permission in writing, or the Intrinio adapter.
- Notifications: email first (earnings tomorrow, your prediction scored, weekly recap); SMS later after Twilio registration.
- Retention and deletion: a player can leave and take their data with them; a club can be closed.
- Monitoring routine; a run book in `docs/`.
- Retire the prototype deployment; the prototype folder stays in the repo as history.
- The first kids' club, grown from the adult club if it went well (Jeff's call, with the adult club's numbers in hand).

Roughly eight to nine weeks of part-time work to the adult club, then four to six weeks of adult play before the first kids' club, if the data layer behaves. Phases 2 and 3 are where the prototype pays back; phase 1 and the license are where the surprises are.

## Working agreement

- Real app on `main`, deploying to the new Vercel project; the prototype's project pinned to its last commit so testers aren't disturbed.
- Each phase: Claude Code builds, Jeff walks it on a phone from the preview URL, notes go in `docs/build_log.md`, the decision log gets its rows the same day.
- Tests on the rules engine, the metrics and the jobs; an end-to-end script that creates a club, joins a kid, places an order, runs the nightly job and checks the board, run against preview before each production deploy (the Deep Thoughts pattern).
- The product rules in `CLAUDE.md` don't change for the real build. The coach prompt quotes them.

## Decisions

Settled 2026-11-09:

- **Database:** Neon Postgres with Drizzle and Better Auth. Supabase declined; the comparison that decided it is below.
- **Order:** the market-data pipeline first, in about a week rather than two, then the screens. Reason unchanged: the unknowns (SEC data cleanup, the price display license) live in the pipeline and every screen reads from its tables.
- **Adult pilot:** a new phase 5. A club of adults plays as kids would for four to six weeks before any kid does; the kids' pilot follows only if it goes well.
- **Hosting:** Vercel Pro from day one, in Jeff's Projects (Jeff upgrades that team to Pro). First placed in the Solar Car Club's Pro team, moved the same day to keep Jeff's projects together.

Settled 2026-11-08:

- **Accounts:** anyone 13 or older creates the club (revised 2026-11-12); players join by invite with Google or an email code; no passwords; no phone sign-in in the pilot. Memberships carry the portfolio; organizers who don't play see the club.
- **Models:** Opus 5.5 for the coach and recap, Haiku 5.5 for the tagger, with the cost tracking above so the coach model can be revisited after phase 4.
- **Prototype:** the coach-refresh bug (issue #5) is fixed and shipped (commit df3ba54, `docs/playtests/2026-11-08_outside_tester_5.md`).

Nothing open. The alternatives considered:

- **Screens first** (the first-15-minutes screens ported onto a one-off snapshot of real numbers, pipeline after) would have given something clickable sooner at the risk of rework. Declined 2026-11-09 for pipeline first.
- **Hobby until the first real club** was the original hosting proposal. Pro's concrete value during the build: crons more than once a day, password protection on preview deploys once test accounts exist, longer log retention and per-route metrics, no non-commercial ambiguity. Since the Pro team already exists, waiting bought nothing.

### Neon or Supabase (the comparison, kept for the record)

| | Neon + Drizzle + Better Auth | Supabase |
| --- | --- | --- |
| What it is | Plain serverless Postgres; auth and migrations are libraries in our code | Postgres plus hosted auth, realtime, storage and a data dashboard, behind one SDK |
| Fit with what Jeff runs | The Deep Thoughts stack: same local setup (PGlite), same tooling, known gotchas | New stack; new learning curve and new gotchas |
| Access rule (a kid sees only their club) | Enforced in app code: a scoping helper on every query, plus tests. Postgres row-level security is available but awkward through Drizzle | Row-level security is first-class and the SDK assumes it; the database itself refuses cross-club reads, a strong guarantee for a public codebase |
| Sign-in | Better Auth: Google and email codes in our tables; needs an email provider for the codes (Resend via Marketplace) | Built-in Google and email codes; the built-in email sender is rate-limited, so a custom SMTP provider is needed anyway |
| Chat and feed | Polling | Realtime subscriptions included |
| Self-hosters (MIT project) | Any Postgres works; nothing proprietary | Need a Supabase project or the heavy self-hosted stack; auth users and RLS policies are tied to Supabase's `auth` schema |
| Vercel | Marketplace native; database branches per preview deploy, good for testing migrations | Marketplace native |
| Cost at pilot scale | Free tier scales to zero; cold start after idle | Free tier pauses the project after a week idle (the nightly cron would keep it awake); Pro is $25/mo |
| Assembly | More pieces to wire ourselves (auth, email, migrations) | Fewer pieces, more decided for us |

Decided for Neon on 2026-11-09. The reasoning: the game's rules engine (fills, fees, taxes, cap, hold) runs server-side either way, so most of what Supabase bundles goes unused, and the stack is already known. The one thing Supabase does better that matters here is database-enforced club isolation; the plan covers that with a scoping helper and a test that tries to read across clubs. Should database-enforced isolation or built-in realtime become necessary, Supabase remains the alternative, and only the sign-in library would change.
