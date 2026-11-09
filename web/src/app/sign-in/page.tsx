import { googleEnabled } from "@/lib/auth_options";
import { GoogleButton } from "./google_button";

// Phase 1 sign-in: Google only, for the internal data page. The invite flow and
// email codes for players come in phase 2.
export default async function SignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="status">
      <h1>Sign in</h1>
      <p className="sub">Owners Club is being built. Sign-in is for the people building it.</p>
      <section className="card">
        {googleEnabled ? <GoogleButton next={next ?? "/admin"} /> : <p>Google sign-in isn&apos;t configured on this deployment.</p>}
      </section>
    </main>
  );
}
