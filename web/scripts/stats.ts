// What's in the market-data cache: row counts and date ranges per table.
// Usage: npx tsx scripts/stats.ts
import "./env";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  const r = (await db.execute(sql`select
    (select count(*) from companies where status = 'active') as active_companies,
    (select count(*) from prices) as price_rows,
    (select min(date) from prices) as first_price,
    (select max(date) from prices) as last_price,
    (select count(distinct ticker) from prices) as priced_tickers,
    (select count(*) from financials) as financial_rows,
    (select count(distinct period) from financials) as periods,
    (select count(*) from earnings_dates) as earnings_rows,
    (select min(date) from earnings_dates) as first_earnings,
    (select max(date) from earnings_dates) as last_earnings,
    (select count(*) from job_runs) as job_runs,
    (select count(*) from job_runs where ok = false) as failed_runs`)) as unknown as { rows: Record<string, unknown>[] };
  console.table(r.rows[0]);
  // Members whose price history is short: new listings, ticker changes, spinoffs.
  const short = (await db.execute(sql`select ticker, count(*) as days, min(date) as first
    from prices group by ticker having count(*) < (select count(distinct date) from prices) * 0.9 order by days`)) as unknown as { rows: Record<string, unknown>[] };
  if (short.rows.length) {
    console.log("Tickers with under 90% of the trading days (new listings, ticker changes, spinoffs):");
    console.table(short.rows);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
