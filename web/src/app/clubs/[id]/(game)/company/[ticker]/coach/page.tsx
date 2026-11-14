// The coach, before a pick: two or three questions on the biggest hole in the
// player's reason, then the thesis. The conversation is private to the player.
import { notFound } from "next/navigation";
import { coachTurn, openConversation } from "@/coach/conversations";
import { companyView } from "@/market/read";
import { companyPath, requirePlayer } from "../../../_lib/player";
import { CoachChat } from "../../../_ui/coach_chat";
import { Page, TopBar } from "../../../_ui/ui";
import { startOver } from "../../../actions";

export const dynamic = "force-dynamic";

export default async function Coach({ params }: { params: Promise<{ id: string; ticker: string }> }) {
  const { id, ticker } = await params;
  const symbol = decodeURIComponent(ticker).toUpperCase();
  const { membership, experience } = await requirePlayer(id, companyPath(id, symbol, "/coach"));
  const c = await companyView(symbol);
  if (!c) notFound();
  const conversation = await openConversation(membership.id, "pick", c.ticker);
  // Brings the conversation up to date: the opening lines the first time, or
  // the reply the coach owed when the page was last closed.
  const turn = await coachTurn(conversation.id, { membershipId: membership.id, name: membership.displayName, experience }, null);

  return (
    <Page className="coach-screen">
      <TopBar back={companyPath(id, c.ticker)} title={`Coach · ${c.name}`} />
      <CoachChat
        key={conversation.id}
        clubId={id}
        conversationId={conversation.id}
        log={turn.log}
        state={turn.state}
        done={turn.done}
        next={{ href: companyPath(id, c.ticker, "/thesis"), label: "Write my thesis" }}
      />
      <form action={startOver} className="center">
        <input type="hidden" name="clubId" value={id} />
        <input type="hidden" name="ticker" value={c.ticker} />
        <button className="start-over">Start this conversation over</button>
      </form>
    </Page>
  );
}
