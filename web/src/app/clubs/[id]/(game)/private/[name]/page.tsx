// A company people ask for that isn't on the stock market. The lesson is why
// (public vs. private, IPOs), then the coach's question: which public
// companies would do well if this one does?
import { notFound } from "next/navigation";
import { coachTurn, openConversation } from "@/coach/conversations";
import { PRIVATE_SCRIPTS } from "@/coach/script";
import { cardsFor } from "@/market/read";
import { clubPath, companyPath, requirePlayer } from "../../_lib/player";
import { CoachChat } from "../../_ui/coach_chat";
import { Card, Page, TopBar } from "../../_ui/ui";

export const dynamic = "force-dynamic";

export default async function PrivateCompany({ params }: { params: Promise<{ id: string; name: string }> }) {
  const { id, name: raw } = await params;
  const wanted = decodeURIComponent(raw).toLowerCase();
  const name = Object.keys(PRIVATE_SCRIPTS).find((n) => n.toLowerCase() === wanted);
  if (!name) notFound();
  const { membership, experience } = await requirePlayer(id, clubPath(id, `/private/${encodeURIComponent(name)}`));
  const conversation = await openConversation(membership.id, "private", name);
  const turn = await coachTurn(conversation.id, { membershipId: membership.id, name: membership.displayName, experience }, null);
  const cards = (await cardsFor(PRIVATE_SCRIPTS[name].tickers.split(","))).map((c) => ({ ...c, href: companyPath(id, c.ticker) }));

  return (
    <Page>
      <TopBar back={clubPath(id, "/pick")} title={name} />
      <Card className="explainer">
        <div className="explainer-icon">🔒</div>
        <h1>You can&apos;t buy {name}. Yet.</h1>
        <p>
          <b>{name} is a private company.</b> Its owners are founders, employees and a few big investors. Its shares aren&apos;t sold on the stock market, so
          it&apos;s not in the S&amp;P 500 and not in this game.
        </p>
        <div className="split">
          <div>
            <b>Private</b>
            <span>Owned by a few people. You can&apos;t buy a piece.</span>
          </div>
          <div>
            <b>Public</b>
            <span>Anyone can buy shares on the stock market.</span>
          </div>
        </div>
        <p>
          When a private company sells shares to everyone for the first time, that&apos;s called an <b>IPO</b> (initial public offering). Until then, you can&apos;t
          buy a piece of it.
        </p>
      </Card>
      <CoachChat key={conversation.id} clubId={id} conversationId={conversation.id} log={turn.log} state={turn.state} done={turn.done} cards={cards} />
    </Page>
  );
}
