"use client";
// The sell slider and what the sale would cost at the last close. The server
// works it out again when the order is placed, and again at the close it
// fills at; these numbers are the same arithmetic on yesterday's price.
import Link from "next/link";
import { useActionState, useState } from "react";
import { daysBetween, longTermDay, sellOldestFirst, taxForSale, type OpenLot, type Realized } from "@/game/ledger";
import { usd } from "@/lib/format";
import { snapAmount } from "@/lib/slider";
import { round2, tradeFee, type GameSettings } from "@/lib/rules";
import { SELL_REASON_MAX } from "@/game/sell_reason";
import { sell, type FormState } from "../../../actions";
import { clubPath } from "../../../_lib/paths";

const rate = (n: number) => `${Math.round(n * 100)}%`;
const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

type Props = { clubId: string; ticker: string; name: string; price: number; most: number; lots: OpenLot[]; sellOn: string; realized: Realized; taxPaid: number; settings: GameSettings };

export function SellForm({ clubId, ticker, name, price, most, lots, sellOn, realized, taxPaid, settings: s }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(sell, {});
  const low = Math.min(100, most);
  const [amount, setAmount] = useState(most);
  const all = most - amount < 1;
  const dollars = all ? most : amount;

  const sale = sellOldestFirst(lots, dollars, price, sellOn, s);
  const gain = round2(sale.realized.short + sale.realized.long);
  const fee = tradeFee(sale.proceeds, s);
  const tax = taxForSale(realized, taxPaid, sale.realized, s);
  const keep = round2(sale.proceeds - fee - tax);

  // The same sale once every share in it has been held past the long-term line, at the same price.
  const touched = new Set(sale.changes.map((c) => c.id));
  const laterDay = lots.filter((l) => touched.has(l.id)).map((l) => longTermDay(l.boughtOn, s)).sort().at(-1);
  const later = laterDay && laterDay > sellOn ? sellOldestFirst(lots, dollars, price, laterDay, s) : null;
  const taxLater = later ? taxForSale(realized, taxPaid, later.realized, s) : tax;
  const keepLater = round2(sale.proceeds - fee - taxLater);
  const waitHelps = later != null && keepLater - keep >= 1;

  return (
    <form action={action}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="amount" value={dollars} />

      <section className="card size-card">
        <div className="size-amount">{usd(dollars)}</div>
        <div className="muted">
          {all ? "everything you can sell" : `${Math.round((dollars / most) * 100)}% of what you can sell`} · about {(dollars / price).toFixed(2)} shares
        </div>
        {most > low && (
          <>
            <input type="range" min={low} max={most} step={1} value={amount} onChange={(e) => setAmount(snapAmount(Number(e.target.value), low, most))} aria-label="Amount to sell" />
            <div className="range-ends">
              <span>{usd(low)}</span>
              <span>{usd(most)} (all of it)</span>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <dl className="fill-lines">
          <div>
            <dt>The shares at the last close</dt>
            <dd>{usd(sale.proceeds, true)}</dd>
          </div>
          <div>
            <dt>Fee ({(s.feeRate * 100).toFixed(1)}%)</dt>
            <dd>−{usd(fee, true)}</dd>
          </div>
          <div>
            <dt>
              {gain > 0
                ? tax > 0
                  ? `Tax on the ${usd(gain)} these shares gained`
                  : `No tax: your earlier losses cover the ${usd(gain)} these shares gained`
                : gain < 0
                  ? tax < 0
                    ? `Tax back, because this is a ${usd(-gain)} loss and you've paid tax on gains before`
                    : `No tax: this is a ${usd(-gain)} loss. It will lower the tax on gains you make later`
                  : "No tax: these shares haven't gained"}
            </dt>
            <dd>
              {tax > 0 ? "−" : tax < 0 ? "+" : ""}
              {usd(Math.abs(tax), true)}
            </dd>
          </div>
          <div className="fill-total">
            <dt>Goes back into your S&amp;P 500 index fund</dt>
            <dd>{usd(keep, true)}</dd>
          </div>
        </dl>
      </section>

      {waitHelps && laterDay && (
        <>
          <div className="sell-compare">
            <section className="card sell-option">
              <small>Sell now</small>
              <div className="keep">{usd(keep)}</div>
              <p>you keep</p>
              <span className="tag">Tax: {usd(tax, true)}</span>
            </section>
            <section className="card sell-option later">
              <small>Wait until {shortDay(laterDay)}</small>
              <div className="keep">{usd(keepLater)}</div>
              <p>you keep</p>
              <span className="tag">Tax: {usd(Math.max(0, taxLater), true)}</span>
            </section>
          </div>
          <p className="muted small center">
            If the price stays the same, which nobody knows. Gains on shares held under 6 months are taxed at {rate(s.shortTermTaxRate)}; after that it&apos;s{" "}
            {rate(s.longTermTaxRate)}. That&apos;s {daysBetween(sellOn, laterDay)} more days for these shares.
          </p>
        </>
      )}

      <label className="field">
        <span>Why are you selling?</span>
        <textarea name="reason" rows={2} maxLength={SELL_REASON_MAX} required placeholder="One line is enough" />
        <small className="muted">Any reason is fine and nobody argues with it. It&apos;s saved with the sale so you can look back at what you were thinking.</small>
      </label>

      <p className="muted small">
        Your sell goes through at the market close on {day(sellOn)} (4 pm in New York), or the next day the market is open.{" "}
        {all
          ? "You're selling every share you can, so what they bring in depends on the price that day."
          : `You're selling ${usd(dollars)} of ${name} at that day's price, so the number of shares, and the tax, will move a little.`}{" "}
        You can cancel until that close.
      </p>

      {state.problem && <p className="notice">{state.problem}</p>}
      <div className="sticky-cta">
        <button className="btn btn-primary" disabled={pending}>
          Sell {usd(dollars)} of {name}
        </button>
      </div>
      <Link className="btn btn-ghost" href={clubPath(clubId, "/portfolio")}>
        Keep it
      </Link>
    </form>
  );
}
