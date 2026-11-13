// Your clubs. Most people have one and go straight to it.
import Link from "next/link";
import { redirect } from "next/navigation";
import { membershipsOf } from "@/clubs/clubs";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Clubs() {
  const me = await requireUser("/clubs");
  const mine = await membershipsOf(me.id);
  if (mine.length === 1) redirect(`/clubs/${mine[0].club.id}`);
  return (
    <main className="status">
      <div className="topnav">
        <span />
        <Link href="/me">Me</Link>
      </div>
      <h1>Your clubs</h1>
      {mine.length === 0 ? (
        <>
          <p className="sub">You aren&apos;t in a club yet.</p>
          <section className="card stack">
            <p>Start one and invite your friends, or open an invite link someone sent you.</p>
            <Link className="button" href="/clubs/new">
              Start a club
            </Link>
          </section>
        </>
      ) : (
        <>
          <p className="sub">Each club is its own game with its own portfolio.</p>
          <section className="card">
            <ul className="roster">
              {mine.map(({ club, membership }) => (
                <li key={club.id}>
                  <span className="face">{membership.avatar}</span>
                  <span className="who">
                    <Link href={`/clubs/${club.id}`}>{club.name}</Link>
                    {membership.role === "organizer" && <span className="tag">organizer</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <Link className="button secondary" href="/clubs/new">
            Start another club
          </Link>
        </>
      )}
    </main>
  );
}
