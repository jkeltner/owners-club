// Step 1: you already own the market. Every player starts with $10,000 in an
// S&P 500 index fund, so the first screen teaches the benchmark before any pick.
import Link from "next/link";
import { roster } from "@/clubs/clubs";
import { marketFact } from "@/content";
import { orderCount } from "@/game/picks";
import { usd } from "@/lib/format";
import { STARTING_VALUE } from "@/lib/rules";
import { marketSnapshot } from "@/market/read";
import { clubPath, requirePlayer } from "../_lib/player";
import { Fold, Linked } from "../_ui/terms";
import { Avatar, Card, Page, TopBar } from "../_ui/ui";

export const dynamic = "force-dynamic";

export default async function Start({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { club, membership, experience } = await requirePlayer(id, clubPath(id, "/start"));
  const [market, members, picks] = await Promise.all([marketSnapshot(), roster(club.id), orderCount(membership.id)]);
  const players = members.filter((m) => m.plays);
  const top10 = market.top10Pct != null ? Math.round(market.top10Pct) : null;
  const listed = marketFact("us_listed_companies");
  const shrink = listed / marketFact("us_listed_companies_1996");
  const asManyAs = shrink > 0.42 && shrink < 0.58 ? "about half as many" : `about ${Math.round(shrink * 100)}% as many`;
  // Players who know the basics get the reasons folded away.
  const isNew = !experience || experience === "new";

  return (
    <Page>
      <TopBar back={clubPath(id)} />
      <p className="eyebrow">Step 1 of 3</p>
      <h1>You already own the market.</h1>
      <Card className="big-money">
        <div className="money">{usd(STARTING_VALUE)}</div>
        <div className="money-label">
          of pretend money, in an S&amp;P 500 <Linked text="index fund" />
        </div>
        <div className="sp-grid" aria-hidden>
          {Array.from({ length: 100 }, (_, i) => (
            <span key={i} className={top10 != null && i < top10 ? "top" : ""} />
          ))}
        </div>
        {top10 != null && <p className="muted small">Each square is $1 of every $100. The gold ones are in the 10 biggest companies.</p>}
        <p>
          That&apos;s a small piece of <b>500 big US companies</b>, like Apple, Nvidia and Costco. Bigger companies get bigger pieces
          {top10 != null ? `: the 10 biggest, mostly tech, are about ${top10}% of it` : ""}. When they do well, so does your money.
        </p>
      </Card>

      <Fold
        startOpen={false}
        title="What's the market?"
        teaser={
          <>
            <b>What&apos;s the market?</b> And what are the Dow and the Nasdaq?
          </>
        }
      >
        <div className="rule">
          <span>🏛️</span>
          <span>
            <b>The stock market is where people buy and sell shares</b>, small pieces of companies. About {listed.toLocaleString("en-US")} US companies sell their
            shares there.
          </span>
        </div>
        <div className="rule">
          <span>📊</span>
          <span>
            <b>The market usually means the S&amp;P 500</b>: 500 of the biggest of those companies. Together they&apos;re worth about{" "}
            {marketFact("sp500_share_of_us_market_pct")}% of the whole US stock market, so when they move, people say the market moved.
          </span>
        </div>
        <div className="rule">
          <span>📰</span>
          <span>
            <Linked text="You'll also hear about the Dow and the Nasdaq." /> The Dow is just 30 big companies. The Nasdaq is mostly tech. Apple, Microsoft, Nvidia
            and Amazon are in all three.
          </span>
        </div>
        <div className="rule">
          <span>🔒</span>
          <span>
            <b>Lots of big businesses aren&apos;t on it.</b> There are {asManyAs} US companies on the stock market as in 1996. Of US companies that sell more than
            $100 million a year, only about 1 in {marketFact("public_one_in")} sells shares to the public. The rest, like OpenAI, are private, so you can&apos;t buy
            them here.
          </span>
        </div>
      </Fold>

      <Fold
        startOpen={isNew}
        title="Why start here?"
        teaser={
          <>
            <b>The index is the score to beat.</b> Every pick moves money out of it, and you only climb the board if your picks beat that money.
          </>
        }
      >
        <div className="rule">
          <span>📈</span>
          <span>
            <b>It&apos;s what most experts tell regular people to do.</b> Over long stretches the S&amp;P 500 has grown about {marketFact("long_run_return_pct")}% a
            year, with no picking at all.
          </span>
        </div>
        <div className="rule">
          <span>🎯</span>
          <span>
            <b>It&apos;s hard to beat.</b> Over 10 or more years, most professional stock pickers do worse than it. So it&apos;s the score to beat, not zero.
          </span>
        </div>
        <div className="rule">
          <span>🔀</span>
          <span>
            <b>Picking means moving money out of it.</b> When you buy a company, the money comes from your index fund. You only climb the board if your picks do
            better than that money would have.
          </span>
        </div>
      </Fold>

      <h2>{club.name}</h2>
      <Card>
        <div className="people">
          {players.map((m) => (
            <span key={m.id}>
              <Avatar emoji={m.avatar} size={30} you={m.id === membership.id} />
              {m.id === membership.id ? `${m.displayName} (you)` : m.displayName}
            </span>
          ))}
        </div>
        <p className="muted small">
          {players.length === 1 ? "You're the first one playing." : `${players.length} people are playing.`} Everyone starts tied with the market. The board, ranked
          by how much each player beats the S&amp;P 500, starts once picks have been bought.
        </p>
      </Card>
      <p className="center muted">Each pick is a bet that you can beat the market.</p>
      <Link className="btn btn-primary" href={clubPath(id, "/pick")}>
        {picks ? "Make another pick" : "Make my first pick"}
      </Link>
    </Page>
  );
}
