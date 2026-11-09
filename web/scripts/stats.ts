// What's in the market-data cache: row counts and date ranges per table.
// Usage: npx tsx scripts/stats.ts
import "./env";
import { sql } from "drizzle-orm";
import { db } from "../src/db";

async function main() {
  const r = await db.execute(sql`select
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
    (select count(*) from job_runs where ok = false) as failed_runs`);
  console.table(r.rows[0]);
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
