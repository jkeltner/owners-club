// Selling a pick: how much, and what it costs to sell now. The coach doesn't
// weigh in here and nothing blocks the sale; the screen shows the numbers.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fillDay, lessShares, sellableLots } from "@/game/ledger";
import { taxLedger } from "@/game/holdings";
import { portfolioOf } from "@/game/portfolio";
import { usd } from "@/lib/format";
import { clubPath, companyPath, requirePlayer } from "../../../_lib/player";
import { Card, Page, TopBar } from "../../../_ui/ui";
import { SellForm } from "./sell_form";

export const dynamic = "force-dynamic";

const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export default async function Sell({ params }: { params: Promise<{ id: string; ticker: string }> }) {
  const { id, ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const { membership, club } = await requirePlayer(id, companyPath(id, symbol, "/sell"));
  const s = club.settings;
  const now = new Date();
  const [p, ledger] = await Promise.all([portfolioOf(membership.id, s, { now }), taxLedger(membership.id)]);
  const h = p.holdings.find((x) => x.ticker === symbol && !x.isIndex);
  if (!h) redirect(clubPath(id, "/portfolio"));
  if (h.price == null || !p.asOf) notFound();
  const sellOn = fillDay(now);
  // The lots an order placed now could sell, oldest first, less the shares already in a waiting sell.
  const free = sellableLots(h.lots, sellOn, s);
  const lots = lessShares(free, free.reduce((a, l) => a + l.shares, 0) - h.sellableShares);
  const most = Math.floor(h.sellableShares * h.price * 100) / 100;
  const lockedValue = h.lots.filter((l) => !l.sellable).reduce((a, l) => a + l.value, 0);

  return (
    <Page>
      <TopBar back={clubPath(id, "/portfolio")} title="Sell" />
      <h1>Sell {h.name}?</h1>
      <p className="muted">
        You own {usd(h.value)} of {h.name} at the last close ({usd(h.price, true)} a share). You put in {usd(h.cost)}.
      </p>
      {most < 1 ? (
        <>
          <Card>
            <p>
              {h.lockedUntil
                ? `This club makes you keep a pick for ${s.minHoldDays} days before selling, so every decision lasts long enough to be judged. ${h.name} can be sold from ${shortDay(h.lockedUntil)}.`
                : `All of your ${h.name} is already in a sell order that's waiting for the market close.`}
            </p>
          </Card>
          <Link className="btn btn-primary" href={clubPath(id, "/portfolio")}>
            Back to your portfolio
          </Link>
        </>
      ) : (
        <>
          {lockedValue >= 1 && h.lockedUntil && (
            <p className="notice">
              {usd(lockedValue)} of it was bought more recently and can&apos;t be sold until {shortDay(h.lockedUntil)}.
            </p>
          )}
          <SellForm clubId={id} ticker={h.ticker} name={h.name} price={h.price} most={most} lots={lots} sellOn={sellOn} realized={ledger.realized} taxPaid={ledger.paid} settings={s} />
        </>
      )}
    </Page>
  );
}
