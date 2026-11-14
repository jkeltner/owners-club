// Sends the one-time sign-in codes through Resend (RESEND_API_KEY, EMAIL_FROM).
// The email carries the code and a button that signs in with one click. The
// button's link puts the email and code after the "#", which browsers never
// send to a server, so they stay out of request logs; the sign-in page reads
// them and submits the same code the person could have typed.
// Without a key, codes print to the server log in development and fail loudly
// anywhere else, so a misconfigured deploy can't silently drop sign-ins.

/** Whether the email-code option should be offered on the sign-in page. */
export const emailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || process.env.NODE_ENV !== "production";

export function signInLink(email: string, code: string) {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  return `${base}/sign-in#email=${encodeURIComponent(email)}&code=${encodeURIComponent(code)}`;
}

export async function sendSignInCode(email: string, code: string, purpose: string) {
  const link = signInLink(email, code);
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: email,
        subject: `${code} is your Owners Club sign-in code`,
        text: `Sign in to Owners Club with one click:\n${link}\n\nOr type this code on the sign-in page: ${code}\n\nBoth work for 10 minutes, once. If you didn't ask for this, ignore this email.`,
        html: `<div style="font-family:system-ui,sans-serif;font-size:16px;color:#1f2a37;max-width:440px">
<p>Sign in to Owners Club:</p>
<p><a href="${link}" style="display:inline-block;background:#2b6b5a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Sign in</a></p>
<p>Or type this code on the sign-in page:</p>
<p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:8px 0">${code}</p>
<p style="color:#5b6672;font-size:14px">Both work for 10 minutes, once. If you didn't ask for this, ignore this email.</p>
</div>`,
      }),
    });
    if (res.ok) return;
    const { logEvent } = await import("./events");
    await logEvent({ level: "error", kind: "email.failed", message: `Sign-in code not sent: HTTP ${res.status}`, detail: { purpose } });
    throw new Error("We couldn't send the code. Try again in a minute.");
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] sign-in code for ${email} (${purpose}): ${code}\n[email] one-click link: ${link}`);
    return;
  }
  const { logEvent } = await import("./events");
  await logEvent({ level: "error", kind: "email.unconfigured", message: "No email provider configured; sign-in code not sent." });
  throw new Error("Email is not set up on this deployment.");
}
