// Size the pick: how much moves out of the index fund and into the company,
// with the club's rules beside the slider.
import { notFound, redirect } from "next/navigation";
import { draftFor, moneyFor } from "@/game/picks";
import { companyView } from "@/market/read";
import { companyPath, requirePlayer } from "../../../_lib/player";
import { Page, TopBar } from "../../../_ui/ui";
import { SizeForm } from "./size_form";

export const dynamic = "force-dynamic";

export default async function Size({ params }: { params: Promise<{ id: string; ticker: string }> }) {
  const { id, ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const { membership, club } = await requirePlayer(id, companyPath(id, symbol, "/size"));
  const c = await companyView(symbol);
  if (!c) notFound();
  // Every pick needs a written reason: no thesis, no "how much?".
  if (!(await draftFor(membership.id, c.ticker))) redirect(companyPath(id, c.ticker, "/thesis"));
  const money = await moneyFor(membership.id, club.settings, c.ticker);

  return (
    <Page>
      <TopBar back={companyPath(id, c.ticker, "/thesis")} title="Size your pick" />
      <h1>How much goes into {c.name}?</h1>
      <SizeForm clubId={id} ticker={c.ticker} name={c.name} money={money} settings={club.settings} />
    </Page>
  );
}
