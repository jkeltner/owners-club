# Owners Club web app

The real build: accounts, a database, real market data and the live coach. Built by the phases in [`docs/build_plan.md`](../docs/build_plan.md); technical decisions are in [`docs/build_spec.md`](../docs/build_spec.md).

## Running it

```
npm install
cp .env.example .env.local   # fill in BETTER_AUTH_SECRET
npm run dev
```

`npm run dev` starts an embedded Postgres (PGlite, in `.data/pglite`), applies the migrations in `drizzle/`, builds the content bundle from `../content`, and runs `next dev` on http://localhost:3000. No cloud services are needed locally.

- `npm test`: unit tests (vitest) against an in-memory Postgres.
- `npm run lint`, `npm run typecheck`.
- `npm run db:generate` after changing `src/db/schema.ts`; commit the new file in `drizzle/`.
- `npm run auth:generate` after changing sign-in options; it rewrites `src/db/auth_schema.ts`.

## Layout

- `src/app/`: Next.js App Router pages and route handlers.
- `src/db/`: Drizzle schema (`schema.ts`, with Better Auth's tables in `auth_schema.ts`) and the connection (`index.ts`).
- `src/lib/`: game rules (`rules.ts`), ranks (`ranks.ts`), formatting, sign-in (`auth*.ts`), monitoring (`events.ts`).
- `src/content/`: the shared catalogs from `../content`, bundled by `scripts/build_content.ts` into a gitignored `generated.json`.
- `scripts/`: local dev server, migrations, content build.
- `tests/`: vitest.

## Deploying

Vercel project `owners-club` in the Pro team, root directory `web/`, production from `main`. `vercel.ts` runs the migrations against Neon (`DATABASE_URL_UNPOOLED`) before each build. Environment variables live in Vercel; `.env.example` lists the names.
