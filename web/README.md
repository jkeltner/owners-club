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

Vercel project `owners-club-web` in Jeff's Projects, root directory `web/`, production from `main` (the GitHub repo is connected; a CLI deploy from inside `web/` fails on the root-directory setting, so deploy by pushing). `vercel.ts` runs the migrations against Neon (`DATABASE_URL_UNPOOLED`) before each build. Environment variables live in Vercel; `.env.example` lists the names.

| Setting | Local | Production | Variable |
| --- | --- | --- | --- |
| Database | embedded PGlite in `.data/pglite` | Neon (Vercel Marketplace) | `DATABASE_URL`, `DATABASE_URL_UNPOOLED` |
| Sign-in | email code printed to the server log, Google if configured | email code by Resend (phase 2), Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| Base URL | `http://localhost:3000` | the production URL | `BETTER_AUTH_URL` |
| Session signing | any random string | a random string per environment | `BETTER_AUTH_SECRET` |

## Google sign-in

One OAuth client covers local and production. In the [Google Cloud console](https://console.cloud.google.com/), create a project (say "Owners Club"), then open **Google Auth Platform**:

1. **Branding**
   - App name: `Owners Club`
   - User support email and developer contact: your Gmail
   - App home page: the production URL
   - Authorized domain: the production host (vercel.app is a public suffix, so each project subdomain counts as its own domain)
2. **Audience**: user type **External**, publishing status **Testing**. Add your own address under Test users; only test users can sign in while it's in Testing. Before the adult club, add their addresses, or publish the app (Google verifies apps that ask only for `openid`, `email` and `profile` without a review).
3. **Data access**: no extra scopes. Better Auth asks only for `openid`, `email` and `profile`.
4. **Clients → Create client → Web application**, named `Owners Club web`:

   | Field | Values |
   | --- | --- |
   | Authorized JavaScript origins | `http://localhost:3000` and the production URL |
   | Authorized redirect URIs | `http://localhost:3000/api/auth/callback/google` and `<production URL>/api/auth/callback/google` |

   Redirect URIs must match exactly: no trailing slash, `https` in production. Changes take a few minutes to apply.
5. Copy the client ID (ends in `.apps.googleusercontent.com`) and the client secret:
   - Local: fill in `GOOGLE_CLIENT_ID=` and `GOOGLE_CLIENT_SECRET=` in `.env.local`, then restart `npm run dev`.
   - Production: `vercel env add GOOGLE_CLIENT_ID production` and `vercel env add GOOGLE_CLIENT_SECRET production` from `web/` (each prompts for the value), then push or redeploy. Env changes apply to new deployments only.

"Continue with Google" appears once both values are set. Someone who joined with an email code can later sign in with Google for the same address; the accounts are linked.

If a custom domain is added later, add its origin and callback URI to the same client and update `BETTER_AUTH_URL`.
