// A clubmate's portfolio as the rest of the club may see it: the mix at the
// last close, as shares of the whole. An organizer who doesn't play sees the
// dollars too.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { seesDollars, viewOf } from "@/clubs/access";
import { roster } from "@/clubs/clubs";
import { mixOf } from "@/game/board";
import { usd } from "@/lib/format";
import { clubPath, companyPath, requireMember } from "../../_lib/player";
import { MixBar } from "../../_ui/charts";
import { Avatar, Card, Page, TopBar } from "../../_ui/ui";

export const dynamic = "force-dynamic";

const COLORS = ["var(--primary)", "var(--gold)", "var(--mint)", "var(--coral)"];
const longDay = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

export default async function Player({ params }: { params: Promise<{ id: string; memberId: string }> }) {
  const { id, memberId } = await params;
  const { membership } = await requireMember(id, clubPath(id, `/players/${memberId}`));
  const them = (await roster(id)).find((m) => m.id === memberId);
  if (!them || !them.plays) notFound();
  const view = viewOf(membership, them);
  if (view === "none") notFound();
  if (view === "own") redirect(clubPath(id, "/portfolio"));
  const dollars = seesDollars(view);
  const mix = await mixOf(them.id);
  let pick = 0;
  const colored = mix.state === "shown" ? mix.parts.map((p) => ({ ...p, color: p.isIndex ? "var(--index)" : COLORS[pick++ % COLORS.length] })) : [];

  return (
    <Page>
      <TopBar back={clubPath(id, "/board")} title="Clubmate" />
      <div className="player-head">
        <Avatar emoji={them.avatar} size={48} />
        <h1>{them.displayName}</h1>
      </div>

      {mix.state === "none" && (
        <Card>
          <p>{them.displayName}&apos;s portfolio hasn&apos;t opened yet. It opens at the first market close after joining.</p>
        </Card>
      )}
      {mix.state === "shown" && (
        <>
          <p className="muted small">
            {dollars
              ? `What ${them.displayName} held at the market close on ${longDay(mix.date)}. You run this club without playing, so you see the dollars too.`
              : `What ${them.displayName} held at the market close on ${longDay(mix.date)}, as shares of their portfolio. The dollars stay private.`}
          </p>
          <MixBar parts={colored.map((p) => ({ label: p.ticker, value: p.value, color: p.color }))} />
          <Card>
            <ul className="trade-list">
              {colored.map((p) => (
                <li key={p.ticker}>
                  <span>
                    <i className="dot" style={{ background: p.color }} /> {p.isIndex ? p.name : membership.plays ? <Link href={companyPath(id, p.ticker)}>{p.name}</Link> : p.name}
                  </span>
                  <b>
                    {Math.round(p.share * 100)}%{dollars ? ` · ${usd(p.value)}` : ""}
                  </b>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
      <Link className="btn btn-secondary" href={clubPath(id, "/board")}>
        Back to the board
      </Link>
    </Page>
  );
}
