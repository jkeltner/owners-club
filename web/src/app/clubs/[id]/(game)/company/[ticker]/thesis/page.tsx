// Step 3: the thesis. Three short parts in the player's own words and one
// prediction that gets checked at the next earnings report.
import { notFound } from "next/navigation";
import { findConversation, readConversation } from "@/coach/conversations";
import { worthWatching } from "@/coach/script";
import { draftFor, predictionRef, thesisParts } from "@/game/picks";
import { METRICS, numberStarters } from "@/game/thesis_text";
import { companyView } from "@/market/read";
import { companyPath, requirePlayer } from "../../../_lib/player";
import { Page, TopBar } from "../../../_ui/ui";
import { ThesisForm } from "./thesis_form";

export const dynamic = "force-dynamic";

export default async function ThesisPage({ params }: { params: Promise<{ id: string; ticker: string }> }) {
  const { id, ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const { membership } = await requirePlayer(id, companyPath(id, symbol, "/thesis"));
  const c = await companyView(symbol);
  if (!c) notFound();
  const [draft, talk] = await Promise.all([draftFor(membership.id, c.ticker), findConversation(membership.id, "pick", c.ticker)]);
  const log = talk ? ((await readConversation(talk.id, membership.id))?.log ?? []) : [];
  const answers = log.filter((m) => m.from === "player").map((m) => m.text);
  const m = c.metrics;
  const when = c.earnings
    ? c.earnings.daysAway <= 1
      ? "in the next day or so"
      : `in about ${c.earnings.daysAway} days`
    : "next (companies report every 3 months)";

  return (
    <Page>
      <TopBar back={companyPath(id, c.ticker, log.length ? "/coach" : "")} title={c.name} />
      <p className="eyebrow">Step 3 of 3</p>
      <h1>Why I&apos;m buying {c.name}</h1>
      <p className="muted">
        {answers.length
          ? "You already did the thinking with the coach. Now put it in three short parts your club will read."
          : "Three short parts, in your own words. Your club will see it."}
      </p>
      <ThesisForm
        clubId={id}
        ticker={c.ticker}
        name={c.name}
        answers={answers}
        watch={worthWatching(log)}
        starters={numberStarters({ name: c.name, pe: m.pe, netIncomeTtm: m.netIncomeTtm, revenueGrowth: m.revenueGrowth, netMargin: m.netMargin })}
        refs={Object.fromEntries(METRICS.map((x) => [x.id, predictionRef(x.id, c.last)]))}
        when={when}
        draft={draft ? { parts: thesisParts(draft), metric: draft.predictionMetric, value: draft.predictionValue } : null}
      />
    </Page>
  );
}
