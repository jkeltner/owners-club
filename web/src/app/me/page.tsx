// The person, across clubs: the experience answer, signing out and deleting the account.
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ExperiencePicker } from "../components/pickers";
import { deleteMe, saveExperience } from "../clubs/actions";
import { SignOutButton } from "./sign_out";

export const dynamic = "force-dynamic";

export default async function Me({ searchParams }: { searchParams: Promise<{ problem?: string }> }) {
  const me = await requireUser("/me");
  const { problem } = await searchParams;
  return (
    <main className="status">
      <div className="topnav">
        <Link href="/clubs">← Your clubs</Link>
      </div>
      <h1>Me</h1>
      <p className="sub">Signed in as {me.email}.</p>
      {problem && <p className="problem">{problem}</p>}
      <section className="card">
        <form action={saveExperience} className="stack">
          <ExperiencePicker value={(me as { experience?: string | null }).experience} />
          <button className="button secondary">Save</button>
        </form>
      </section>
      <SignOutButton />
      <details className="confirm" style={{ marginTop: 24 }}>
        <summary>Delete my account</summary>
        <form action={deleteMe} className="stack">
          <p className="muted small">
            This deletes your sign-in and everything you&apos;ve done in every club: picks, theses, coach conversations. It can&apos;t be undone. If you&apos;re
            the only organizer of a club with other people in it, make someone else an organizer first.
          </p>
          <label className="check">
            <input type="checkbox" name="sure" value="yes" required /> I understand
          </label>
          <button className="button danger">Delete my account</button>
        </form>
      </details>
      <p className="muted small" style={{ marginTop: 24 }}>
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
