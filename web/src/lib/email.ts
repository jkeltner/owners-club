// Sends the one-time sign-in codes through Resend (RESEND_API_KEY, EMAIL_FROM).
// Without a key, codes print to the server log in development and fail loudly
// anywhere else, so a misconfigured deploy can't silently drop sign-ins.

/** Whether the email-code option should be offered on the sign-in page. */
export const emailEnabled = Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM) || process.env.NODE_ENV !== "production";

export async function sendSignInCode(email: string, code: string, purpose: string) {
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
        text: `Your Owners Club sign-in code is ${code}.\n\nIt works for 10 minutes. If you didn't ask for it, ignore this email.`,
      }),
    });
    if (res.ok) return;
    const { logEvent } = await import("./events");
    await logEvent({ level: "error", kind: "email.failed", message: `Sign-in code not sent: HTTP ${res.status}`, detail: { purpose } });
    throw new Error("We couldn't send the code. Try again in a minute.");
  }
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] sign-in code for ${email} (${purpose}): ${code}`);
    return;
  }
  const { logEvent } = await import("./events");
  await logEvent({ level: "error", kind: "email.unconfigured", message: "No email provider configured; sign-in code not sent." });
  throw new Error("Email is not set up on this deployment.");
}
