// The portfolio: what it's worth, what you'd keep after tax and the fee to sell, how that compares
// with leaving the money in the index, and every holding with what selling it
// would cost. Valued once a day, at the last close.
import Link from "next/link";
import { clubIsOpen, fillDay, unrealized } from "@/game/ledger";
import { ordersOf } from "@/game/picks";
import { daysOf, portfolioOf, type PortfolioHolding } from "@/game/portfolio";
import { signedPct, usd } from "@/lib/format";
import { INDEX_TICKER, STARTING_VALUE, tradeFee, type GameSettings } from "@/lib/rules";
import { displayName } from "@/market/names";
import { clubPath, companyPath, requirePlayer } from "../_lib/player";
import { DriftChart, MixBar } from "../_ui/charts";
import { Card, Page, TopBar } from "../_ui/ui";

export const dynamic = "force-dynamic";

const COLORS = ["var(--primary)", "var(--gold)", "var(--mint)", "var(--coral)"];
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const rate = (n: number) => `${Math.round(n * 100)}%`;
const returnOn = (kept: number) => (kept / STARTING_VALUE - 1) * 100;
const feePct = (s: GameSettings) => `${(s.feeRate * 100).toFixed(1)}%`;

export default async function Portfolio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { membership, club } = await requirePlayer(id, clubPath(id, "/portfolio"));
  const s = club.settings;
  const [p, orders, days] = await Promise.all([portfolioOf(membership.id, s), ordersOf(membership.id), daysOf(membership.id)]);
  const waiting = orders.filter((o) => o.order.status === "waiting");
  const past = orders.filter((o) => o.order.status !== "waiting");
  const picks = p.holdings.filter((h) => !h.isIndex);
  const colorOf = (ticker: string) => (ticker === INDEX_TICKER ? "var(--index)" : COLORS[Math.max(0, picks.findIndex((h) => h.ticker === ticker)) % COLORS.length]);
  // A company sold out of still shows in the drift chart, so its name comes from the trades too.
  const names = new Map([...orders.map((o) => [o.order.ticker, displayName(o.order.ticker, o.name ?? o.order.ticker)] as const), ...p.holdings.map((h) => [h.ticker, h.name] as const)]);
  const nameOf = (ticker: string) => names.get(ticker) ?? ticker;

  if (!p.opened || !p.asOf) {
    return (
      <Page>
        <TopBar back={clubPath(id)} title="Portfolio" />
        <h1>Your portfolio</h1>
        <Card>
          <p>
            {clubIsOpen(club.opensOn)
              ? `Your ${usd(STARTING_VALUE)} goes into the S&P 500 index fund at the next market close (4 pm in New York, Monday to Friday). Your portfolio shows up here the morning after.`
              : `This club opens on ${longDay(club.opensOn)}. Your ${usd(STARTING_VALUE)} goes into the S&P 500 index fund at that day's market close (4 pm in New York), and your portfolio shows up here the morning after. Picks can be placed from that day.`}
          </p>
        </Card>
        <Waiting id={id} rows={waiting} />
        <Link className="btn btn-primary" href={clubPath(id, orders.length ? "/pick" : "/start")}>
          {orders.length ? "Make another pick" : "Make your first pick"}
        </Link>
      </Page>
    );
  }

  // Someone who joined after the club opened: their starting money is dated the opening day.
  const firstDay = p.holdings.find((h) => h.isIndex)?.lots.map((l) => l.boughtOn).sort()[0] ?? null;
  const joinedLate = firstDay != null && fillDay(membership.joinedAt) > firstDay;
  const mine = returnOn(p.kept);
  const market = p.index ? returnOn(p.index.kept) : null;
  const largest = picks.reduce((m, h) => Math.max(m, h.share), 0);
  // The drift chart: each day's holdings as shares of that day's total, index at the bottom.
  const driftOrder = [INDEX_TICKER, ...new Set(days.flatMap((d) => d.holdings.map((h) => h.ticker)).filter((t) => t !== INDEX_TICKER))];
  const drift = days.map((d) => ({ date: d.date, shares: Object.fromEntries(d.holdings.map((h) => [h.ticker, d.value > 0 ? h.value / d.value : 0])) }));

  return (
    <Page>
      <TopBar back={clubPath(id)} title="Portfolio" />
      <h1>Your portfolio</h1>
      <p className="muted small">At the market close on {longDay(p.asOf)}. It updates once a day, overnight.</p>

      <Card className="three-numbers four">
        <div>
          <small>Worth</small>
          <b>{usd(p.total)}</b>
        </div>
        <div>
          <small>{p.taxOwed >= 0 ? "Tax if you sold it all" : "Tax back if you sold it all"}</small>
          <b>{usd(Math.abs(p.taxOwed))}</b>
        </div>
        <div>
          <small>Fee to sell it all ({feePct(s)})</small>
          <b>{usd(p.feeToSell)}</b>
        </div>
        <div className="key">
          <small>What you&apos;d keep</small>
          <b>{usd(p.kept)}</b>
        </div>
      </Card>

      <Card className="vs-card">
        <div className="vs-row">
          <span>You, after tax and the fee</span>
          <b>{signedPct(mine)}</b>
        </div>
        {market != null && (
          <>
            <div className="vs-row">
              <span>If you&apos;d left it all in the S&amp;P 500, after tax and the fee</span>
              <b>{signedPct(market)}</b>
            </div>
            <div className="vs-row total">
              <span>You vs. the market</span>
              <b>{Math.abs(mine - market) < 0.05 ? "Even" : signedPct(mine - market)}</b>
            </div>
          </>
        )}
        <p className="muted small">
          Both start from your {usd(STARTING_VALUE)}. Each is what you&apos;d keep if you sold everything today: the tax on the gains comes out, and so does the{" "}
          {feePct(s)} fee on the sale. That&apos;s the number the game compares.
          Fees paid so far: <b>{usd(p.feesPaid, true)}</b> · Taxes paid: <b>{usd(p.taxesPaid, true)}</b>
        </p>
        {joinedLate && (
          <p className="muted small">
            You joined after this club opened on {longDay(firstDay!)}. So that everyone is measured over the same stretch, your {usd(STARTING_VALUE)} went into the index
            fund on that day, the same as everyone else&apos;s. What the index has done since then is already in your numbers.
          </p>
        )}
        <Link className="btn btn-ghost" href={clubPath(id, "/board")}>
          See the club&apos;s board
        </Link>
      </Card>

      <h2>What you own</h2>
      <MixBar parts={p.holdings.map((h) => ({ label: h.ticker, value: h.value, color: colorOf(h.ticker) }))} />
      {picks.length > 0 && (
        <p className="muted small">
          Your largest pick is <b>{Math.round(largest * 100)}%</b> of your portfolio.
        </p>
      )}
      {p.holdings.map((h) => (
        <HoldingCard key={h.ticker} id={id} h={h} asOf={p.asOf!} s={s} color={colorOf(h.ticker)} />
      ))}
      <Link className="btn btn-secondary" href={clubPath(id, orders.length ? "/pick" : "/start")}>
        ＋ {orders.length ? "Make another pick" : "Make your first pick"}
      </Link>

      <Waiting id={id} rows={waiting} />

      {drift.length >= 2 && (
        <>
          <h2>How your mix has changed</h2>
          <Card>
            <DriftChart days={drift} order={driftOrder} colors={Object.fromEntries(driftOrder.map((t) => [t, colorOf(t)]))} />
            <div className="range-ends">
              <span>{shortDay(drift[0].date)}</span>
              <span>{shortDay(drift.at(-1)!.date)}</span>
            </div>
            <div className="legend">
              {driftOrder.map((t) => (
                <span key={t}>
                  <i style={{ background: colorOf(t) }} />
                  {t === INDEX_TICKER ? "S&P 500" : nameOf(t)}
                </span>
              ))}
            </div>
            <p className="small">
              The colors show how much of your money was in each holding, day by day. A pick that grows faster than the rest takes up more of the picture without you
              buying any more of it.
            </p>
          </Card>
        </>
      )}

      {past.length > 0 && (
        <>
          <h2>Your trades</h2>
          <Card>
            <ul className="trade-list">
              {past.map(({ order, name }) => (
                <li key={order.id}>
                  <Link href={clubPath(id, `/orders/${order.id}`)}>
                    {order.side === "sell" ? "Sold" : "Bought"} {displayName(order.ticker, name ?? order.ticker)}
                  </Link>
                  <span className="muted small">
                    {order.status === "filled" && order.fillDate ? `${shortDay(order.fillDate)} · ${usd(order.filledAmount ?? order.amount)}` : order.status === "cancelled" ? "cancelled" : "didn't go through"}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </Page>
  );
}

function Waiting({ id, rows }: { id: string; rows: Awaited<ReturnType<typeof ordersOf>> }) {
  if (!rows.length) return null;
  return (
    <>
      <h2>Waiting for the market close</h2>
      <Card>
        <ul className="trade-list">
          {rows.map(({ order, name }) => (
            <li key={order.id}>
              <Link href={clubPath(id, `/orders/${order.id}`)}>
                🌙 {order.side === "sell" ? "Selling" : "Buying"} {displayName(order.ticker, name ?? order.ticker)}
              </Link>
              <span className="muted small">
                {order.side === "sell" ? "about " : ""}
                {usd(order.amount)}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function HoldingCard({ id, h, asOf, s, color }: { id: string; h: PortfolioHolding; asOf: string; s: GameSettings; color: string }) {
  const gain = h.value - h.cost;
  const split = unrealized(h.lots, asOf, s);
  // Each holding on its own: its gains at their rates. The top of the page nets losses against gains across everything.
  const tax = Math.max(0, split.short) * s.shortTermTaxRate + Math.max(0, split.long) * s.longTermTaxRate;
  const nextLongTerm = h.lots.filter((l) => l.longTermOn > asOf && l.value > l.cost).map((l) => l.longTermOn).sort()[0];
  const fee = tradeFee(h.value, s);
  const canSell = !h.isIndex && h.price != null && h.sellableShares * h.price >= 1;
  return (
    <Card className="holding">
      <div className="holding-top">
        <i className="swatch" style={{ background: color }} />
        <div className="holding-name">
          <b>{h.isIndex ? h.name : <Link href={companyPath(id, h.ticker)}>{h.name}</Link>}</b>
          <small>{Math.round(h.share * 100)}% of your portfolio</small>
        </div>
        <div className="holding-value">
          <b>{usd(h.value)}</b>
          <small>{Math.abs(gain) < 0.5 ? "no change" : `${gain > 0 ? "up" : "down"} ${usd(Math.abs(gain))}`}</small>
        </div>
      </div>
      {Math.abs(gain) >= 0.5 && (
        <p className="holding-tax">
          {gain > 0 ? (
            <>
              {h.isIndex ? `This money was ${usd(h.cost)} when it went in.` : `You put in ${usd(h.cost)}.`} Tax if sold today: <b>{usd(tax, true)}</b>
              {split.long <= 0 ? ` (${rate(s.shortTermTaxRate)} of the ${usd(gain)} gain)` : split.short <= 0 ? ` (${rate(s.longTermTaxRate)} of the ${usd(gain)} gain)` : ""}, plus a{" "}
              <b>{usd(fee, true)}</b> fee.
            </>
          ) : (
            <>
              {h.isIndex ? `This money was ${usd(h.cost)} when it went in.` : `You put in ${usd(h.cost)}.`} That&apos;s a {usd(-gain)} loss so far. If you sold, it would
              lower the tax on your gains, and the fee would be <b>{usd(fee, true)}</b>.
            </>
          )}
        </p>
      )}
      <div className="holding-tags">
        {h.isIndex && <span className="tag">Moves when you make a pick · no {rate(s.capAtPurchase)} limit</span>}
        {!h.isIndex && h.lockedUntil && <span className="tag lock">🔒 {h.sellableShares > 0 ? "Some of it can't" : "Can't"} be sold until {shortDay(h.lockedUntil)}</span>}
        {canSell && <span className="tag">Can be sold</span>}
        {gain > 0 && nextLongTerm && (
          <span className="tag">
            {rate(s.shortTermTaxRate)} tax on the gain now · {rate(s.longTermTaxRate)} from {shortDay(nextLongTerm)}
          </span>
        )}
      </div>
      {canSell && (
        <Link className="btn btn-secondary" href={companyPath(id, h.ticker, "/sell")}>
          Sell?
        </Link>
      )}
    </Card>
  );
}
