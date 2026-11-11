// The internal data page: what the nightly job did, and every company with its
// computed numbers, to eyeball against a finance site. Admins only.
import { desc, inArray, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { companies, earningsDates, financials, jobRuns, prices } from "@/db/schema";
import { bigUsd, usd } from "@/lib/format";
import { getSession, isAdminEmail } from "@/lib/session";
import { computeMetrics, onePerCompany, peBand, type CompanyMetrics } from "@/market/metrics";
import { INDEX_FUND_TICKER } from "@/market/massive";
import { RunStepForm } from "./run_step";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const session = await getSession();
  if (!session) redirect("/sign-in?next=/admin");
  if (!isAdminEmail(session.user.email)) {
    return (
      <main className="status">
        <h1>Not an admin</h1>
        <p className="sub">Signed in as {session.user.email}. This page is for the people building Owners Club.</p>
      </main>
    );
  }

  const runs = await db.select().from(jobRuns).orderBy(desc(jobRuns.startedAt)).limit(8);
  const members = await db.select().from(companies).orderBy(companies.ticker);
  const ciks = members.map((m) => m.cik).filter((c): c is number => c != null);
  const fin = ciks.length ? await db.select().from(financials).where(inArray(financials.cik, ciks)) : [];
  const finByCik = new Map<number, typeof fin>();
  for (const f of fin) finByCik.set(f.cik, [...(finByCik.get(f.cik) ?? []), f]);

  // Latest close per ticker.
  const latest = await db
    .select({ ticker: prices.ticker, date: sql<string>`max(${prices.date})` })
    .from(prices)
    .groupBy(prices.ticker);
  const priceRows = latest.length
    ? await db
        .select()
        .from(prices)
        .where(sql`(${prices.ticker}, ${prices.date}) in (select ticker, max(date) from prices group by ticker)`)
    : [];
  const priceByTicker = new Map(priceRows.map((p) => [p.ticker, p]));
  const [{ priceDays }] = await db.select({ priceDays: sql<number>`count(distinct ${prices.date})` }).from(prices);
  const upcoming = await db.select().from(earningsDates).where(sql`${earningsDates.date} >= current_date`).orderBy(earningsDates.date).limit(12);

  const rows = members.map((m) => {
    const price = priceByTicker.get(m.ticker)?.close ?? null;
    const metrics = computeMetrics(m.cik ? (finByCik.get(m.cik) ?? []) : [], price);
    return { ...m, metrics };
  });
  const active = rows.filter((r) => r.status === "active");
  // Company-level totals count a dual listing (GOOG and GOOGL) once.
  const activeCompanies = onePerCompany(active);
  const withPe = activeCompanies.filter((r) => r.metrics.pe != null);
  const indexPe = sumPe(activeCompanies.map((r) => r.metrics));
  const byLens = new Map<string, number[]>();
  for (const r of withPe) byLens.set(r.lens ?? "(no lens)", [...(byLens.get(r.lens ?? "(no lens)") ?? []), r.metrics.pe!]);
  const spy = priceByTicker.get(INDEX_FUND_TICKER);

  return (
    <main className="status wide">
      <h1>Data</h1>
      <p className="sub">
        {active.length} members · {rows.filter((r) => r.lens).length} with a lens · {priceDays} days of prices{spy ? ` · SPY ${usd(spy.close, true)} on ${spy.date}` : " · no index fund price yet"} · {activeCompanies.length} companies · {withPe.length} with a P/E
        {indexPe ? ` · market P/E ${indexPe}` : ""}
      </p>

      <section className="card">
        <h2>Jobs</h2>
        <RunStepForm />
        <table className="data">
          <thead>
            <tr><th>Started</th><th>Job</th><th>Result</th><th>Summary</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.startedAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td>{r.job}</td>
                <td>{r.ok == null ? "running" : r.ok ? "ok" : "failed"}</td>
                <td><code>{JSON.stringify(r.summary ?? r.error ?? {}).slice(0, 400)}</code></td>
              </tr>
            ))}
            {!runs.length && <tr><td colSpan={4}>No runs yet.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Sector P/E bands (middle half)</h2>
        <dl>
          {[...byLens.entries()].sort().map(([lens, pes]) => {
            const band = peBand(pes);
            return (
              <div key={lens} className="row">
                <dt>{lens} ({pes.length})</dt>
                <dd>{band ? `${band[0]} to ${band[1]}` : "too few"}</dd>
              </div>
            );
          })}
        </dl>
      </section>

      <section className="card">
        <h2>Reporting soon</h2>
        <p>{upcoming.length ? upcoming.map((e) => `${e.ticker} ${e.date}`).join(" · ") : "No earnings dates yet."}</p>
      </section>

      <section className="card">
        <h2>Companies</h2>
        <p className="sub">Mkt cap marks: no mark = shares outstanding as reported; ᵈ = weighted-average diluted shares (company reports shares only per share class); ᵉ = estimated as trailing net income ÷ trailing diluted EPS.</p>
        <table className="data">
          <thead>
            <tr>
              <th>Ticker</th><th>Name</th><th>Lens</th><th>Close</th><th>Mkt cap</th><th>P/E</th><th>Revenue TTM</th><th>Growth</th><th>Gross</th><th>Net</th><th>FCF</th><th>Quarters</th><th>Latest</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const m = r.metrics;
              return (
                <tr key={r.ticker} className={r.status === "removed" ? "muted" : undefined}>
                  <td>{r.ticker}</td>
                  <td>{r.name}</td>
                  <td>{r.lens ?? <span className="muted">{r.subIndustry}</span>}</td>
                  <td>{m.price != null ? usd(m.price, true) : "·"}</td>
                  <td>
                    {m.marketCap != null ? bigUsd(m.marketCap / 1e9) : "·"}
                    {m.marketCap != null && m.sharesSource !== "reported" && <SharesMark source={m.sharesSource} />}
                  </td>
                  <td>{m.pe ?? "·"}</td>
                  <td>{m.revenueTtm != null ? bigUsd(m.revenueTtm / 1e9) : "·"}</td>
                  <td>{m.revenueGrowth != null ? `${m.revenueGrowth}%` : "·"}</td>
                  <td>{m.grossMargin != null ? `${m.grossMargin}%` : "·"}</td>
                  <td>{m.netMargin != null ? `${m.netMargin}%` : "·"}</td>
                  <td>{m.fcfMargin != null ? `${m.fcfMargin}%` : "·"}</td>
                  <td>{m.quartersAvailable}</td>
                  <td>{m.latestPeriod ?? "·"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}

function SharesMark({ source }: { source: CompanyMetrics["sharesSource"] }) {
  if (source === "diluted") return <sup title="Share count is the weighted-average diluted shares, not shares outstanding">ᵈ</sup>;
  if (source === "derived") return <sup title="Share count estimated as trailing net income ÷ trailing diluted EPS">ᵉ</sup>;
  return null;
}

function sumPe(ms: CompanyMetrics[]) {
  const withBoth = ms.filter((m) => m.marketCap != null && m.netIncomeTtm != null);
  if (withBoth.length < 50) return null;
  const cap = withBoth.reduce((a, m) => a + m.marketCap!, 0);
  const earnings = withBoth.reduce((a, m) => a + m.netIncomeTtm!, 0);
  return earnings > 0 ? Math.round((cap / earnings) * 10) / 10 : null;
}
