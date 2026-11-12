// One company's stored financial rows and the quarters computed from them,
// for checking a number against its filings.
// Usage: npx tsx scripts/company_rows.ts FDX MDT
import "./env";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db";
import { companies, financials } from "../src/db/schema";
import { computeMetrics, contiguous, quarters } from "../src/market/metrics";

const m = (n: number | null | undefined) => (n == null ? "·" : Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(0)}M` : String(n));

async function main() {
  const tickers = process.argv.slice(2).map((t) => t.toUpperCase());
  if (!tickers.length) throw new Error("Give one or more tickers");
  const members = await db.select().from(companies).where(inArray(companies.ticker, tickers));
  for (const c of members) {
    const rows = c.cik ? await db.select().from(financials).where(eq(financials.cik, c.cik)) : [];
    rows.sort((a, b) => ((a.periodEnd ?? "") < (b.periodEnd ?? "") ? 1 : -1));
    console.log(`\n== ${c.ticker} ${c.name} · CIK ${c.cik} · ${rows.length} rows`);
    console.log("stored (newest first): period, start to end, revenue, net income, EPS, diluted shares, shares outstanding");
    for (const r of rows.slice(0, 16)) console.log(`  ${r.period.padEnd(9)} ${r.periodStart} to ${r.periodEnd}  rev ${m(r.revenue)}  ni ${m(r.netIncome)}  eps ${r.epsDiluted ?? "·"}  dil ${m(r.sharesDiluted)}  out ${m(r.sharesOutstanding)}`);
    const qs = quarters(rows);
    console.log("quarters (newest first):");
    for (const q of qs.slice(0, 9)) console.log(`  ${q.period.padEnd(9)} ${q.periodStart} to ${q.periodEnd}  rev ${m(q.revenue)}  ni ${m(q.netIncome)}  eps ${q.epsDiluted ?? "·"}${q.derived ? "  (derived)" : ""}`);
    const mt = computeMetrics(rows, null);
    console.log(`last four back to back: ${contiguous(qs.slice(0, 4))} · trailing revenue ${m(mt.revenueTtm)} · trailing net income ${m(mt.netIncomeTtm)} · trailing EPS ${mt.epsTtm ?? "·"}`);
  }
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
