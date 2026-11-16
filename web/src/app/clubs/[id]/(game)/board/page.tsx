// The club's board: who is ahead of the S&P 500 and by how much, over the same
// stretch for everyone, with how each return was made beside it. Updated once
// a day with the portfolios.
import Link from "next/link";
import { BELL_WINDOW, boardOf, type BoardRow, type BoardWindow } from "@/game/board";
import { signedPct } from "@/lib/format";
import { clubPath, requireMember } from "../_lib/player";
import { Avatar, Card, Page, TopBar } from "../_ui/ui";

export const dynamic = "force-dynamic";

const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const LABEL: Record<BoardWindow, string> = { start: "Since each start", "3m": "3 months", "6m": "6 months", "12m": "12 months" };
const STRETCH: Record<BoardWindow, string> = { start: "since they started", "3m": "over the last 3 months", "6m": "over the last 6 months", "12m": "over the last 12 months" };
const playing = (days: number) => (days < 1 ? "first day" : days < 60 ? `playing ${days} day${days === 1 ? "" : "s"}` : `playing ${Math.floor(days / 30)} months`);
const lead = (vs: number) => (Math.abs(vs) < 0.05 ? "Even" : signedPct(vs));

export default async function BoardPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ w?: string }> }) {
  const { id } = await params;
  const { w } = await searchParams;
  const { membership } = await requireMember(id, clubPath(id, "/board"));
  const board = await boardOf(id, w);
  const back = clubPath(id);
  const windows = (Object.keys(LABEL) as BoardWindow[]).filter((k) => k === "start" || board.open[k] || k === "3m" || k === "6m");

  if (!board.asOf) {
    return (
      <Page>
        <TopBar back={back} title="Board" />
        <h1>The board</h1>
        <Card>
          <p>
            Nobody&apos;s portfolio has opened yet. Everyone&apos;s $10,000 goes into the S&amp;P 500 index fund at the next market close (4 pm in New York, Monday to
            Friday), and the board shows up here the morning after.
          </p>
        </Card>
      </Page>
    );
  }

  // The market sits on the board as a line at zero: everyone above it is ahead of the index.
  const aheadOf = board.ranked.findIndex((r) => r.standing!.vs < 0);
  const marketAt = aheadOf === -1 ? board.ranked.length : aheadOf;

  return (
    <Page>
      <TopBar back={back} title="Board" />
      <h1>The board</h1>
      <p className="muted small">At the market close on {longDay(board.asOf)}. It updates once a day, overnight.</p>

      <div className="chips">
        {windows.map((k) =>
          board.open[k] ? (
            <Link key={k} className={`chip ${k === board.window ? "chip-active" : ""}`} href={clubPath(id, `/board?w=${k}`)}>
              {LABEL[k]}
            </Link>
          ) : (
            <span key={k} className="chip chip-off">
              {LABEL[k]}
            </span>
          ),
        )}
      </div>
      {(!board.open["3m"] || !board.open["6m"]) && (
        <p className="muted small">
          {!board.open["3m"] ? "The 3-month and 6-month boards open" : "The 6-month board opens"} once someone has played that long. Until then the board measures everyone
          from their own first day.
        </p>
      )}

      <Card className="board">
        <ol>
          {board.ranked.map((r, i) => (
            <li key={r.membershipId}>
              {i === marketAt && <MarketLine />}
              <Row id={id} r={r} rank={i + 1} you={r.membershipId === membership.id} bell={board.bell.holder === r.membershipId} />
            </li>
          ))}
          {marketAt === board.ranked.length && (
            <li>
              <MarketLine />
            </li>
          )}
        </ol>
      </Card>

      <p className="small">
        The big number is how far ahead of the S&amp;P 500 (or behind it) each player is {STRETCH[board.window]}. Both sides are counted the same way: what you&apos;d
        keep if you sold everything today, after tax and the selling fee. Under each name is how the return was made: how many picks, and how much rides on the biggest
        one. A lead that comes from one big pick is not the same as that lead spread across eight.
      </p>

      {board.waiting.length > 0 && (
        <>
          <h2>Not on this board yet</h2>
          <Card>
            <ul className="trade-list">
              {board.waiting.map((r) => (
                <li key={r.membershipId}>
                  <span>
                    {r.avatar} {r.name}
                  </span>
                  <span className="muted small">{r.started ? `started ${shortDay(r.started)}` : "portfolio opens at the next market close"}</span>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      <h2>🔔 The Bell</h2>
      <Card>
        {board.bell.holder ? (
          <p>
            <b>{[...board.ranked, ...board.waiting].find((r) => r.membershipId === board.bell.holder)?.name}</b> holds the Bell: the title for whoever leads the 6-month
            board. It&apos;s named for the bell that opens the stock market each morning.
          </p>
        ) : (
          <p>
            The Bell is the title for whoever leads the 6-month board, named for the bell that opens the stock market each morning. Nobody holds it yet, because nobody
            has played 6 months{board.bell.firstChance ? `. The first chance is ${shortDay(board.bell.firstChance)}.` : "."}
          </p>
        )}
        {board.bell.holder && board.window !== BELL_WINDOW && (
          <Link className="btn btn-ghost" href={clubPath(id, `/board?w=${BELL_WINDOW}`)}>
            See the 6-month board
          </Link>
        )}
      </Card>
    </Page>
  );
}

function MarketLine() {
  return (
    <div className="board-market">
      <span>S&amp;P 500 index fund</span>
      <span>the line to beat</span>
    </div>
  );
}

function Row({ id, r, rank, you, bell }: { id: string; r: BoardRow; rank: number; you: boolean; bell: boolean }) {
  const s = r.standing!;
  return (
    <Link className={`board-row ${you ? "you" : ""}`} href={you ? clubPath(id, "/portfolio") : clubPath(id, `/players/${r.membershipId}`)}>
      <span className="rank">{rank}</span>
      <Avatar emoji={r.avatar} size={36} you={you} />
      <span className="who">
        <b>
          {r.name}
          {you ? " (you)" : ""}
          {bell ? " 🔔" : ""}
        </b>
        <small>
          {r.picks === 0 ? "all in the index fund" : `${r.picks} pick${r.picks === 1 ? "" : "s"} · biggest is ${Math.round(r.largest * 100)}%`} · {playing(r.daysPlaying)}
        </small>
      </span>
      <span className="lead">
        <b>{lead(s.vs)}</b>
        <small>
          {signedPct(s.mine)} · S&amp;P {signedPct(s.market)}
        </small>
      </span>
    </Link>
  );
}
