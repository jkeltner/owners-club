"use client";
// The slider and the rules. The server checks the amount again when the order
// is placed; the slider only keeps honest players inside the lines.
import { useActionState, useState } from "react";
import type { Money } from "@/game/picks";
import { usd } from "@/lib/format";
import { snapAmount } from "@/lib/slider";
import { tradeFee, type GameSettings } from "@/lib/rules";
import { buy, type FormState } from "../../../actions";
import { MixBar } from "../../../_ui/charts";
import { Linked } from "../../../_ui/terms";

const pct = (n: number) => `${Math.round(n * 1000) / 10}%`;
const share = (n: number) => (n === 0.25 ? "a quarter" : n === 0.5 ? "half" : n === 1 ? "all" : pct(n));

export function SizeForm({ clubId, ticker, name, money, settings }: { clubId: string; ticker: string; name: string; money: Money; settings: GameSettings }) {
  const [state, action, pending] = useActionState<FormState, FormData>(buy, {});
  const low = Math.min(100, money.max);
  const [amount, setAmount] = useState(Math.min(1000, money.max));
  const fee = tradeFee(amount, settings);
  const index = money.portfolio - money.inPicks - amount;
  const others = money.inPicks - money.inThisCompany;
  const months = Math.round(settings.minHoldDays / 30.4);

  if (money.max < 1) {
    return (
      <p className="notice">
        {money.indexLeft < 1
          ? "All of your money is already in picks, so there's nothing left in your index fund to move."
          : `You already have ${usd(money.inThisCompany)} in ${name}, which is this club's limit for one company (${pct(settings.capAtPurchase)} of your portfolio).`}
      </p>
    );
  }

  return (
    <form action={action}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="amount" value={amount} />
      <p className="muted">
        The money comes out of your S&amp;P 500 index fund{money.inPicks > 0 ? ` (${usd(money.indexLeft)} is still in it)` : ""}. Whatever you don&apos;t move stays there,
        matching the market.
      </p>

      <section className="card size-card">
        <div className="size-amount">{usd(amount)}</div>
        <div className="muted">{Math.round(((amount + money.inThisCompany) / money.portfolio) * 100)}% of your portfolio</div>
        <input type="range" min={low} max={money.max} step={1} value={amount} onChange={(e) => setAmount(snapAmount(Number(e.target.value), low, money.max))} aria-label="Amount to move into the pick" />
        <div className="range-ends">
          <span>{usd(low)}</span>
          <span>{usd(money.max)} max</span>
        </div>
        <MixBar
          parts={[
            { label: name, value: amount + money.inThisCompany, color: "var(--primary)" },
            { label: "Other picks", value: others, color: "var(--mint)" },
            { label: "S&P 500", value: index, color: "var(--index)" },
          ]}
        />
        <div className="legend">
          <span>
            <i style={{ background: "var(--primary)" }} />
            {name} {usd(amount + money.inThisCompany)}
          </span>
          {others > 0 && (
            <span>
              <i style={{ background: "var(--mint)" }} />
              Other picks {usd(others)}
            </span>
          )}
          <span>
            <i style={{ background: "var(--index)" }} />
            S&amp;P 500 {usd(index)}
          </span>
        </div>
      </section>

      <section className="card rules-card">
        <div className="rule">
          <span>🧢</span>
          <span>
            <b>{pct(settings.capAtPurchase)} limit.</b> No single company can be more than {usd(money.cap)} ({share(settings.capAtPurchase)} of your money) when you buy
            it, so one surprise can&apos;t sink you.
          </span>
        </div>
        <div className="rule">
          <span>🧾</span>
          <span>
            <b>Fee: {usd(fee, true)}</b> ({pct(settings.feeRate)} of the amount), taken out of what you move. Real trading has costs too, and they add up if you trade a lot.
          </span>
        </div>
        <div className="rule">
          <span>🏛️</span>
          <span>
            <b>Tax, if your index money has grown.</b> You&apos;re selling index fund to buy this. If that money is worth more than when it went in, tax on the gain (
            {pct(settings.shortTermTaxRate)} if it&apos;s been there under 6 months, {pct(settings.longTermTaxRate)} after) also comes out of what you move. Your order
            shows the exact amount once it goes through.
          </span>
        </div>
        <div className="rule">
          <span>🔒</span>
          <span>
            {settings.minHoldDays === 0 ? (
              <>
                <b>No waiting to sell in this club.</b> The usual game makes you keep a pick for 3 months.
              </>
            ) : settings.minHoldDays >= 85 ? (
              <>
                <b>You can&apos;t sell it for {months} months.</b> That&apos;s long enough to see at least one <Linked text="earnings report" />, when the company shares
                its results.
              </>
            ) : (
              <>
                <b>You can&apos;t sell it for {settings.minHoldDays} days.</b> This club set a shorter wait than the usual 3 months.
              </>
            )}{" "}
            Your index money can move anytime.
          </span>
        </div>
        <div className="rule">
          <span>🌙</span>
          <span>
            <b>
              Buys at <Linked text="the next close" />.
            </b>{" "}
            Your price is the last price of the day the next time the market closes (4 pm in New York, Monday to Friday), so there&apos;s no reason to watch the
            market all day.
          </span>
        </div>
      </section>

      {state.problem && <p className="notice">{state.problem}</p>}
      <div className="sticky-cta">
        <button className="btn btn-primary" disabled={pending}>
          Buy {usd(amount)} of {name}
        </button>
      </div>
    </form>
  );
}
