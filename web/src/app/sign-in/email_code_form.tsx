"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth_client";

// Two steps on one card: ask for the email, then for the 6-digit code we sent.
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
    else setSent(true);
  }

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
    window.location.assign(next);
  }

  if (!sent) {
    return (
      <form onSubmit={send} className="stack">
        <label className="field">
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <small>We&apos;ll email you a 6-digit code.</small>
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
        The code we sent to {email}
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
