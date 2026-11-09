// One-off loads against the database in .env.local (Neon). Each is the nightly
// step with a wider window, so it's safe to re-run:
//   npx tsx scripts/backfill.ts sp500
//   npx tsx scripts/backfill.ts financials --quarters 20 --years 6
//   npx tsx scripts/backfill.ts prices --from 2024-11-01     (Massive free plan: ~5 calls a minute)
import "./env";
import { refreshEarnings, refreshFinancials, refreshPrices, refreshSp500 } from "../src/jobs/nightly";
import { runJob } from "../src/jobs/runner";

const [what, ...rest] = process.argv.slice(2);
const isoDaysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
const flag = (name: string, fallback: string) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : fallback;
};

async function main() {
  switch (what) {
    case "sp500":
      return runJob("backfill.sp500", [{ name: "sp500", run: refreshSp500 }]);
    case "financials": {
      const quarters = Number(flag("quarters", "20"));
      const years = Number(flag("years", "6"));
      return runJob("backfill.financials", [{ name: "financials", run: () => refreshFinancials({ quarters, years }) }]);
    }
    case "prices": {
      // refreshPrices resumes after the latest stored day. On an empty table the
      // --from date seeds the walk (default: two years back, the Basic plan's history).
      // One grouped-daily call per weekday, paced for the free tier, so a two-year
      // seed takes about two hours; rerunning resumes where it stopped.
      const days = Number(flag("days", "600"));
      const from = flag("from", isoDaysAgo(730));
      return runJob("backfill.prices", [{ name: "prices", run: () => refreshPrices(days, from) }]);
    }
    case "earnings":
      return runJob("backfill.earnings", [{ name: "earnings", run: () => refreshEarnings() }]);
    default:
      throw new Error("usage: backfill.ts sp500 | financials [--quarters N --years N] | prices [--days N --from YYYY-MM-DD] | earnings");
  }
}

main()
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
