// The front door. Signed in goes straight to your club; signed out sees what
// the game is and the two ways in (start a club, or open an invite link).
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getSession();
  if (session) redirect("/clubs");
  return (
    <main className="status">
      <h1>Owners Club</h1>
      <p className="sub">A stock-picking game for you and your friends that rewards understanding businesses, not betting on prices.</p>

      <section className="card stack">
        <p>
          Everyone starts with $10,000 of pretend money in the S&amp;P 500, a basket of 500 big American companies. You make picks you can explain, and an AI coach
          asks questions that test your reasoning. The club&apos;s leaderboard measures everyone against that basket.
        </p>
        <p>
          <Link className="button" href="/clubs/new">
            Start a club
          </Link>{" "}
          <Link className="button secondary" href="/sign-in">
            Sign in
          </Link>
        </p>
        <p className="muted small">Got an invite link from a friend? Open that link to join their club.</p>
      </section>

      <p className="muted small">
        No real money is involved. <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
