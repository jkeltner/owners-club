"use client";
import { useEffect, useRef, useState } from "react";
import { authClient } from "@/lib/auth_client";

// Where to go after signing in, remembered in this browser so the button in
// the email can finish a trip that started on an invite link.
const NEXT_KEY = "oc_next";
const safePath = (p: string | null) => (p && p.startsWith("/") && !p.startsWith("//") ? p : null);
function rememberNext(next: string) {
  try {
    window.localStorage.setItem(NEXT_KEY, next);
  } catch {}
}
function takeNext(): string | null {
  try {
    const v = window.localStorage.getItem(NEXT_KEY);
    window.localStorage.removeItem(NEXT_KEY);
    return safePath(v);
  } catch {
    return null;
  }
}

// Two steps on one card: ask for the email, then for the 6-digit code we sent.
// The email's button opens this page with the email and code after the "#";
// the page signs in with them straight away.
export function EmailCodeForm({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setBusy(false);
    if (res.error) setError(res.error.message ?? "We couldn't send the code. Try again in a minute.");
    else {
      rememberNext(next);
      setSent(true);
    }
  }

  // Arriving from the email's button.
  const tried = useRef(false);
  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    const linkEmail = params.get("email");
    const linkCode = params.get("code");
    if (!linkEmail || !linkCode) return;
    // Take them out of the address bar and the history.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    void (async () => {
      setEmail(linkEmail);
      setSent(true);
      setBusy(true);
      const res = await authClient.signIn.emailOtp({ email: linkEmail, otp: linkCode });
      if (res.error) {
        setBusy(false);
        setError("That link has been used or has run out. Send a new one.");
        return;
      }
      window.location.assign(takeNext() ?? next);
    })();
  }, [next]);

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.emailOtp({ email, otp: code.trim() });
    if (res.error) {
      setBusy(false);
      setError("That code didn't work. Check it, or send a new one.");
      return;
    }
    takeNext();
    window.location.assign(next);
  }

  if (!sent) {
    return (
      <form onSubmit={send} className="stack">
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <small>We&apos;ll email you a sign-in button and a 6-digit code. Either one works.</small>
        </label>
        <button className="button secondary" disabled={busy}>
          {busy ? "Sending…" : "Email me a code"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    );
  }
  return (
    <form onSubmit={verify} className="stack">
      <label className="field">
        Press the button in the email we sent to {email}, or type its code here
        <input type="text" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <small>It works for 10 minutes.</small>
      </label>
      <button className="button" disabled={busy}>
        {busy ? "Checking…" : "Sign in"}
      </button>{" "}
      <button type="button" className="button quiet" onClick={() => { setSent(false); setCode(""); }}>
        Use a different email
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
