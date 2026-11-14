// Step 2: start from curiosity. Type a company or browse a theme; whatever the
// player names becomes the first lesson. Curation, not recommendation.
import { notInGame, themes } from "@/content";
import { clubTheses, orderCount } from "@/game/picks";
import { displayName } from "@/market/names";
import { cardsFor } from "@/market/read";
import { clubPath, requirePlayer } from "../_lib/player";
import { Avatar, Card, Page, TopBar } from "../_ui/ui";
import { Finder } from "./finder";

export const dynamic = "force-dynamic";

export default async function Pick({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { club, membership } = await requirePlayer(id, clubPath(id, "/pick"));
  const [picks, friends, themed] = await Promise.all([
    orderCount(membership.id),
    clubTheses(club.id, membership.id),
    Promise.all(
      themes.map(async (t) => ({
        name: t.name,
        blurb: t.blurb.split(".")[0],
        cards: await cardsFor(t.tickers),
        locked: notInGame.filter((p) => p.theme === t.name).map((p) => p.name),
      })),
    ),
  ]);
  const returning = picks > 0;
  const cap = Math.round(club.settings.capAtPurchase * 100);

  return (
    <Page>
      <TopBar back={clubPath(id, returning ? "" : "/start")} />
      <p className="eyebrow">{returning ? "Another pick" : "Step 2 of 3"}</p>
      <h1>{returning ? "What company are you curious about now?" : "What companies do you use, love, or think will be huge?"}</h1>
      {returning && <p className="muted">The money comes out of your index fund, up to {cap}% per company. The coach goes first, like last time.</p>}
      <Finder clubId={id} themes={themed} locked={notInGame.map((p) => p.name)} />

      {friends.length > 0 && (
        <>
          <h2>Why your clubmates bought</h2>
          <div className="scroller">
            {friends.map((t, i) => (
              <Card key={i} className="thesis-mini">
                <div className="row">
                  <Avatar emoji={t.who.avatar} size={28} />
                  <b>
                    {t.who.displayName} bought {displayName(t.ticker, t.officialName)}
                  </b>
                </div>
                <p>&ldquo;{t.text}&rdquo;</p>
              </Card>
            ))}
          </div>
        </>
      )}
    </Page>
  );
}
