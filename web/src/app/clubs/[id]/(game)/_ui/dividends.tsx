// What the buy screen and the company page say about a company's dividend, and
// the choice of where it goes. Plain markup, so client and server screens share it.
import type { DividendInto } from "@/db/schema";
import type { DividendYear } from "@/game/dividends";
import { usd } from "@/lib/format";
import { Linked } from "./terms";

const day = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
const rate = (n: number) => `${Math.round(n * 100)}%`;

/** The plain explanation: what it paid over the last year, as a share of the price, and how the game pays it. */
export function DividendExplainer({ name, year, price, taxRate }: { name: string; year: DividendYear; price: number | null; taxRate: number }) {
  const yieldPct = price && year.perShare > 0 ? (year.perShare / price) * 100 : null;
  return (
    <>
      <b>{name} pays a dividend.</b> <Linked text="A dividend is part of a company's profit, sent as cash to whoever owns its shares." />{" "}
      {year.payments > 0 ? (
        <>
          Over the last year {name} paid {usd(year.perShare, true)} a share{year.payments > 1 ? ` in ${year.payments} payments` : ""}
          {yieldPct != null && (
            <>
              , about {yieldPct.toFixed(1)}% of its price: $1,000 of it would have brought in about {usd(yieldPct * 10)} a year
            </>
          )}
          .{" "}
        </>
      ) : (
        <>It doesn&apos;t pay one regularly. </>
      )}
      {year.special && (
        <>
          It also paid a one-off {usd(year.special.perShare, true)} a share on {day(year.special.exDate)}.{" "}
        </>
      )}
      {year.next && (
        <>
          The next one is {year.next.special ? "a one-off " : ""}
          {usd(year.next.perShare, true)} a share, for anyone who owns it before {day(year.next.exDate)}.{" "}
        </>
      )}
      On the day a dividend is paid out, the share price usually drops by about that much, because the cash has left the company. The game pays you that day, less{" "}
      {rate(taxRate)} tax.
    </>
  );
}

/** Two radio buttons: the index fund (the default) or more of the company. */
export function DividendChoiceFields({ name, into }: { name: string; into: DividendInto }) {
  return (
    <fieldset className="picker">
      <legend>Where should {name}&apos;s dividends go?</legend>
      <div className="choices">
      <label>
        <input type="radio" name="dividends" value="index" defaultChecked={into !== "reinvest"} />
        <span>
          <b>Into your S&amp;P 500 index fund</b>
          <small>Spread across 500 companies, like the rest of your money.</small>
        </span>
      </label>
      <label>
        <input type="radio" name="dividends" value="reinvest" defaultChecked={into === "reinvest"} />
        <span>
          <b>More {name}</b>
          <small>Your pick grows by the dividend, with no fee. Those shares can be sold any time.</small>
        </span>
      </label>
      </div>
    </fieldset>
  );
}
