// The person, across clubs: the experience answer and signing out.
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { ExperiencePicker } from "../components/pickers";
import { saveExperience } from "../clubs/actions";
import { SignOutButton } from "./sign_out";

export const dynamic = "force-dynamic";

export default async function Me() {
  const me = await requireUser("/me");
  return (
    <main className="status">
      <div className="topnav">
        <Link href="/clubs">← Your clubs</Link>
      </div>
      <h1>Me</h1>
      <p className="sub">Signed in as {me.email}.</p>
      <section className="card">
        <form action={saveExperience} className="stack">
          <ExperiencePicker value={(me as { experience?: string | null }).experience} />
          <button className="button secondary">Save</button>
        </form>
      </section>
      <SignOutButton />
      <p className="muted small" style={{ marginTop: 24 }}>
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
