// Where an invite link lands. Signed out, it shows which club and asks you to
// sign in; signed in (and past the Agree click) it asks the three things a
// player needs: a name, an avatar and how much you already know.
import Link from "next/link";
import { redirect } from "next/navigation";
import { findInvite, hasAgreed, membershipIn } from "@/clubs/clubs";
import { getSession } from "@/lib/session";
import { AvatarPicker, ExperiencePicker } from "../../components/pickers";
import { join } from "../../clubs/actions";

export const dynamic = "force-dynamic";

export default async function Join({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const found = await findInvite(code);
  if (!found) {
    return (
      <main className="status">
        <h1>This invite link isn&apos;t working</h1>
        <p className="sub">It has expired or been turned off. Ask the person who sent it for a new one.</p>
        <Link href="/">Owners Club</Link>
      </main>
    );
  }
  const here = `/join/${found.invite.code}`;
  const session = await getSession();
  if (!session) {
    return (
      <main className="status">
        <h1>Join {found.club.name}</h1>
        <p className="sub">You&apos;ve been invited to a club on Owners Club, a stock-picking game played with pretend money.</p>
        <section className="card stack">
          <p>
            Everyone starts with $10,000 of pretend money in the S&amp;P 500, a basket of 500 big American companies. You make picks you can explain, and an AI
            coach asks questions that test your reasoning.
          </p>
          <Link className="button" href={`/sign-in?next=${encodeURIComponent(here)}`}>
            Sign in to join
          </Link>
          <p className="muted small">You need to be 13 or older. There are no passwords: use Google or a code sent to your email.</p>
        </section>
      </main>
    );
  }
  if (!(await hasAgreed(session.user.id))) redirect(`/welcome?next=${encodeURIComponent(here)}`);
  if (await membershipIn(session.user.id, found.club.id)) redirect(`/clubs/${found.club.id}`);
  const experience = (session.user as { experience?: string | null }).experience;
  return (
    <main className="status">
      <h1>Join {found.club.name}</h1>
      <p className="sub">Three quick things and you&apos;re in.</p>
      <form action={join} className="stack">
        <input type="hidden" name="code" value={found.invite.code} />
        <section className="card stack">
          <label className="field">
            Your name in the club
            <input type="text" name="displayName" maxLength={30} required defaultValue={session.user.name?.split(" ")[0] ?? ""} />
            <small>What clubmates see. A first name or nickname is plenty.</small>
          </label>
          <AvatarPicker />
        </section>
        <section className="card stack">
          <ExperiencePicker value={experience} />
        </section>
        <p className="muted small">
          Good to know: this club&apos;s organizers who aren&apos;t playing can see every player&apos;s picks and trades as they happen. Your conversations with the
          coach are private to you.
        </p>
        <button className="button">Join the club</button>
      </form>
    </main>
  );
}
