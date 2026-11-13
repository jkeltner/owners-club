// The Agree click, once per version of the Terms: 13 or older, the Terms and
// the Privacy Policy. No birthdate is asked and nothing is pre-ticked; the
// button is the agreement, and we store when and which version.
import Link from "next/link";
import { redirect } from "next/navigation";
import { hasAgreed, recordAgreement } from "@/clubs/clubs";
import { getSession, safeNext } from "@/lib/session";

async function agree(formData: FormData) {
  "use server";
  const session = await getSession();
  const next = safeNext(String(formData.get("next") ?? ""), "/clubs");
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  await recordAgreement(session.user.id);
  redirect(next);
}

export default async function Welcome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const to = safeNext(next, "/clubs");
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(to)}`);
  if (await hasAgreed(session.user.id)) redirect(to);
  return (
    <main className="status">
      <h1>Before you start</h1>
      <p className="sub">Two things to know about Owners Club.</p>
      <section className="card stack">
        <p>
          <b>The money is pretend.</b> Nothing here buys or sells a real stock, and nothing you win or lose is real money.
        </p>
        <p>
          <b>The coach is an AI.</b> It asks questions and shows numbers to test your thinking. It isn&apos;t a person and it doesn&apos;t give financial advice.
        </p>
        <form action={agree} className="stack">
          <input type="hidden" name="next" value={to} />
          <p className="small">
            By clicking Agree you confirm you are 13 or older and accept the <Link href="/terms">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
          <button className="button">Agree</button>
        </form>
      </section>
    </main>
  );
}
