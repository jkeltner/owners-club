// The company card: the price, four numbers every owner should know, what
// buyers expect (the P/E against a typical company), the sector lens and the
// next earnings date. Every number is real and comes with a comparison.
import Link from "next/link";
import { notFound } from "next/navigation";
import { sectorPlural } from "@/content";
import { holdingsOf } from "@/game/holdings";
import { ordersOf } from "@/game/picks";
import { bigUsd, isPeOffScale, peLabel, signedPct, usd } from "@/lib/format";
import { lensValue } from "@/market/lens_values";
import { companyView, marketSnapshot, usualPe } from "@/market/read";
import { clubPath, companyPath, requirePlayer } from "../../_lib/player";
import { PeScale, PriceChart } from "../../_ui/charts";
import { Linked } from "../../_ui/terms";
import { Card, Page, Stat, TopBar } from "../../_ui/ui";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const quarterLabel = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
const billions = (dollars: number) => bigUsd(dollars / 1e9);

export default async function Company({ params }: { params: Promise<{ id: string; ticker: string }> }) {
  const { id, ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const { membership } = await requirePlayer(id, companyPath(id, symbol));
  const [c, market, mine, mineHeld] = await Promise.all([companyView(symbol), marketSnapshot(), ordersOf(membership.id), holdingsOf(membership.id)]);
  if (!c) notFound();
  const m = c.metrics;
  const l = c.lens;
  const typical = market.marketPe != null ? Math.round(market.marketPe) : null;
  const range = usualPe(l?.kind, market);
  const kind = l ? sectorPlural(l.kind) : undefined;
  const lensRows = l ? [l.look_first, ...l.then] : [];
  const waiting = mine.filter((o) => o.order.ticker === c.ticker && o.order.status === "waiting" && o.order.side === "buy").reduce((a, o) => a + o.order.amount, 0);
  const owned = mineHeld.holdings.find((h) => h.ticker === c.ticker);
  const first = c.series[0];
  const change = first && c.price != null && c.series.length > 1 ? (c.price / first.close - 1) * 100 : null;
  const losing = m.netIncomeTtm != null && m.netIncomeTtm <= 0;

  return (
    <Page>
      <TopBar back={clubPath(id, "/pick")} title={c.ticker} />
      <h1 className="co-name">{c.name}</h1>
      <p className="muted">{c.line}</p>
      {owned && (
        <p className="notice">
          You own {usd(owned.value)} of {c.name} at the last close. You put in {usd(owned.cost)}. <Link href={clubPath(id, "/portfolio")}>See it in your portfolio</Link>
        </p>
      )}
      {waiting > 0 && (
        <p className="notice">
          You have {usd(waiting)} waiting to go into {c.name} at the next market close.
        </p>
      )}

      <Card>
        {c.price != null ? (
          <>
            <div className="price-row">
              <span className="price">{usd(c.price, true)}</span>
              <span className="price-sub">
                for one share, at the <Linked text="closing price" /> on {day(c.priceDate!)}
              </span>
            </div>
            {c.series.length > 1 && <PriceChart series={c.series} />}
            {change != null && (
              <p className="muted small">
                {signedPct(change)} {c.series.length >= 240 ? "over the past year" : `since ${day(first.date)}`}. Prices update once a day.
              </p>
            )}
          </>
        ) : (
          <p className="muted">We don&apos;t have a price for {c.name} yet.</p>
        )}
      </Card>

      <Card className="stats">
        <Stat label="Whole company" value={m.marketCap != null ? billions(m.marketCap) : "n/a"} conceptSlug="market-cap-vs-share-price" sub="market cap" />
        <Stat
          label="P/E"
          value={m.pe != null ? (isPeOffScale(m.pe) ? peLabel(m.pe) : `${m.pe.toFixed(0)}x`) : "n/a"}
          conceptSlug="pe-ratio"
          sub={m.pe != null ? (isPeOffScale(m.pe) ? "tiny profit next to the price" : `$${m.pe.toFixed(0)} per $1 of profit`) : losing ? "no profit this year" : m.netIncomeTtm != null ? "missing its share count" : "not enough reports yet"}
        />
        <Stat
          label="Revenue"
          value={m.revenueTtm != null ? billions(m.revenueTtm) : "n/a"}
          conceptSlug="revenue-vs-earnings"
          sub={m.revenueTtm == null ? "not enough reports yet" : m.revenueGrowth != null ? `${signedPct(m.revenueGrowth, 0)} vs. the year before` : "over the last 12 months"}
        />
        <Stat
          label="Earnings (profit)"
          value={m.netIncomeTtm != null ? billions(m.netIncomeTtm) : "n/a"}
          conceptSlug="revenue-vs-earnings"
          sub={
            m.netIncomeTtm == null
              ? "not enough reports yet"
              : losing
                ? "lost money over the last 12 months"
                : m.netMargin != null
                  ? `keeps ${m.netMargin.toFixed(0)}¢ of each $1 of sales as profit`
                  : "over the last 12 months"
          }
        />
      </Card>

      <Card className="pe-card">
        {m.pe == null ? (
          <>
            <h3>
              Why there&apos;s no <Linked text="P/E" />
            </h3>
            <p className="small">
              {losing
                ? `${c.name} lost money over the last 12 months, so there's no profit to divide by. For a company like this, look at whether sales are growing and whether the losses are shrinking.`
                : m.netIncomeTtm != null
                  ? `A P/E is what the whole company costs divided by a year of profit. We're missing how many shares ${c.name} has, so we can't add up what the whole company costs yet.`
                  : `A P/E is the price divided by a year of profit, and we don't have a full year of ${c.name}'s reports yet. Until we do, look at what it sells and whether sales are growing.`}
            </p>
          </>
        ) : isPeOffScale(m.pe) ? (
          <>
            <h3>What buyers expect</h3>
            <PeScale pe={m.pe} market={typical} range={range} sector={kind} />
            <p className="small">
              {c.name}&apos;s <Linked text="P/E" /> is over 100: its profit over the last 12 months was very small compared with its price. Sometimes buyers are
              paying a lot for growth they expect. Sometimes a one-time cost wiped out most of a year&apos;s profit. Its profit in each of the last four quarters
              (3 months each) shows which:
            </p>
            {c.profits.length > 0 && (
              <div className="quarters">
                {[...c.profits].reverse().map((q) => (
                  <div key={q.periodEnd}>
                    <small>to {quarterLabel(q.periodEnd)}</small>
                    <b>{billions(q.netIncome)}</b>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <h3>What buyers expect</h3>
            <PeScale pe={m.pe} market={typical} range={range} sector={kind} />
            <p className="small">
              A <Linked text="P/E" /> of {m.pe.toFixed(0)} means buyers pay ${m.pe.toFixed(0)} for each $1 of yearly profit. Plain math: if {c.name}&apos;s profits
              never grew, it would take <b>{m.pe.toFixed(0)} years</b> of profits to add up to what you pay.{" "}
              {typical == null
                ? ""
                : m.pe > typical * 1.3
                  ? "Buyers pay that much because they expect profits to grow a lot."
                  : m.pe < typical * 0.8
                    ? "Buyers are paying less than for a typical company: they expect less growth, or see more risk."
                    : "That's close to a typical company."}
            </p>
          </>
        )}
      </Card>

      {l && (
        <Card className="lens">
          <p className="eyebrow">For {l.kind.toLowerCase()}, what matters</p>
          {lensRows.map((label, i) => {
            const v = lensValue(label, m);
            return (
              <div key={label} className={i <= 1 ? "lens-section" : ""}>
                {i <= 1 && <span className={`lens-tag ${i === 0 ? "first" : ""}`}>{i === 0 ? "Look at first" : "Then"}</span>}
                <div className="lens-metric">
                  <span>
                    <Linked text={label} />
                  </span>
                  {v ? (
                    <span className="lens-value">
                      {v.value}
                      {v.sub && <small>{v.sub}</small>}
                    </span>
                  ) : (
                    <span className="lens-value none">we don&apos;t have this number yet</span>
                  )}
                </div>
              </div>
            );
          })}
          <div className="lens-section">
            <span className="lens-tag careful">Careful with</span>
            <p className="small">
              <Linked text={l.careful_with} />
            </p>
          </div>
        </Card>
      )}

      <Card className="earnings-note">
        <span>📅</span>
        {c.earnings ? (
          <span>
            <Linked text={`${c.name} reports earnings`} />{" "}
            {c.earnings.daysAway <= 0 ? <b>today</b> : c.earnings.daysAway === 1 ? <b>tomorrow</b> : <>in <b>{c.earnings.daysAway} days</b></>}
            {c.earnings.status === "estimated" ? ` (around ${day(c.earnings.date)}; the company hasn't confirmed the date)` : ` (${day(c.earnings.date)})`}. That&apos;s when
            your prediction gets checked.
          </span>
        ) : (
          <span>
            <Linked text={`We don't have the date ${c.name} next reports earnings.`} /> Companies report every 3 months, and that&apos;s when your prediction gets
            checked.
          </span>
        )}
      </Card>

      <p className="source-note">
        Sales and profit are from {c.name}&apos;s own reports to the government (the SEC), added up over its last four quarters. Prices are the last close of the
        day.
      </p>

      <div className="sticky-cta">
        <Link className="btn btn-primary" href={companyPath(id, c.ticker, "/coach")}>
          Make a pick
        </Link>
      </div>
    </Page>
  );
}
