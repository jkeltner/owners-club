import Link from "next/link";
import { redirect } from "next/navigation";
import { googleEnabled } from "@/lib/auth_options";
import { emailEnabled } from "@/lib/email";
import { getSession, safeNext } from "@/lib/session";
import { EmailCodeForm } from "./email_code_form";
import { GoogleButton } from "./google_button";

// Sign-in is Google or a one-time code by email: no passwords. A new person
// and a returning one use the same page; the Agree click comes right after.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const to = safeNext(next, "/clubs");
  if (await getSession()) redirect(to);
  return (
    <main className="status">
      <h1>Sign in</h1>
      <p className="sub">New here or coming back, it&apos;s the same step. There are no passwords.</p>
      {error && <p className="error">That sign-in didn&apos;t go through. Try again.</p>}
      <section className="card stack">
        {googleEnabled && <GoogleButton next={to} />}
        {googleEnabled && emailEnabled && <p className="muted small">or</p>}
        {emailEnabled && <EmailCodeForm next={to} />}
        {!googleEnabled && !emailEnabled && <p>Sign-in isn&apos;t configured on this deployment.</p>}
      </section>
      <p className="muted small">
        <Link href="/terms">Terms</Link> · <Link href="/privacy">Privacy</Link>
      </p>
    </main>
  );
}
