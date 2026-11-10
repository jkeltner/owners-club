// The numbers the /admin page shows, printed to the terminal: market P/E,
// sector P/E bands, the biggest companies, and the extremes to eyeball
// against a finance site.
// Usage: npx tsx scripts/admin_check.ts
import "./env";
import { inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { companies, financials, prices } from "../src/db/schema";
import { computeMetrics, onePerCompany, peBand } from "../src/market/metrics";

async function main() {
  const members = await db.select().from(companies).where(sql`${companies.status} = 'active'`);
  const ciks = members.map((m) => m.cik).filter((c): c is number => c != null);
  const fin = await db.select().from(financials).where(inArray(financials.cik, ciks));
  const byCik = new Map<number, typeof fin>();
  for (const f of fin) byCik.set(f.cik, [...(byCik.get(f.cik) ?? []), f]);
  const priceRows = await db
    .select()
    .from(prices)
    .where(sql`(${prices.ticker}, ${prices.date}) in (select ticker, max(date) from prices group by ticker)`);
  const price = new Map(priceRows.map((p) => [p.ticker, p.close]));
  const tickers = members.map((m) => ({
    ticker: m.ticker,
    cik: m.cik,
    lens: m.lens,
    m: computeMetrics(m.cik ? (byCik.get(m.cik) ?? []) : [], price.get(m.ticker) ?? null),
  }));
  // Totals, bands and rankings count a dual listing (GOOG and GOOGL) once;
  // the per-ticker "missing" and "loss-making" lists keep both.
  const rows = onePerCompany(tickers);
  const withPe = rows.filter((r) => r.m.pe != null);
  const withCap = rows.filter((r) => r.m.marketCap != null);
  const both = rows.filter((r) => r.m.marketCap != null && r.m.netIncomeTtm != null);
  const cap = both.reduce((a, r) => a + r.m.marketCap!, 0);
  const ni = both.reduce((a, r) => a + r.m.netIncomeTtm!, 0);
  console.log(
    `active ${tickers.length} tickers, ${rows.length} companies · with market cap ${withCap.length} · with P/E ${withPe.length} · market P/E ${(cap / ni).toFixed(1)} over ${both.length} companies · total cap $${(cap / 1e12).toFixed(1)}T`,
  );
  console.log("missing market cap:", tickers.filter((r) => r.m.marketCap == null).map((r) => r.ticker).join(" "));
  const bands = new Map<string, number[]>();
  for (const r of withPe) {
    const k = r.lens ?? "(no lens)";
    bands.set(k, [...(bands.get(k) ?? []), r.m.pe!]);
  }
  console.table([...bands.entries()].sort().map(([lens, pes]) => ({ lens, n: pes.length, band: peBand(pes)?.join(" to ") ?? "too few" })));
  const top = [...withCap].sort((a, b) => b.m.marketCap! - a.m.marketCap!).slice(0, 12);
  console.table(
    top.map((r) => ({
      ticker: r.ticker,
      price: r.m.price,
      capB: Math.round(r.m.marketCap! / 1e9),
      pe: r.m.pe,
      revTtmB: r.m.revenueTtm == null ? null : Math.round(r.m.revenueTtm / 1e9),
      growth: r.m.revenueGrowth,
      net: r.m.netMargin,
      latest: r.m.latestPeriod,
    })),
  );
  const sorted = [...withPe].sort((a, b) => a.m.pe! - b.m.pe!);
  console.log("lowest P/E:", sorted.slice(0, 5).map((r) => `${r.ticker} ${r.m.pe}`).join(", "));
  console.log("highest P/E:", sorted.slice(-5).map((r) => `${r.ticker} ${r.m.pe}`).join(", "));
  const bySource = new Map<string, string[]>();
  for (const r of rows) if (r.m.sharesSource && r.m.sharesSource !== "reported") bySource.set(r.m.sharesSource, [...(bySource.get(r.m.sharesSource) ?? []), r.ticker]);
  for (const [source, list] of bySource) console.log(`shares from ${source} (${list.length}):`, list.join(" "));
  console.log("loss-making (no P/E):", tickers.filter((r) => r.m.netIncomeTtm != null && r.m.netIncomeTtm <= 0).map((r) => r.ticker).join(" "));
}
main().then(() => process.exit(0), (e) => { console.error(e); process.exit(1); });
