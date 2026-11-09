// Sends the one-time sign-in codes. Phase 2 wires a provider (Resend through the
// Vercel Marketplace); until then codes print to the server log in development
// and fail loudly anywhere else, so a misconfigured deploy can't silently drop
// sign-ins.
export async function sendSignInCode(email: string, code: string, purpose: string) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[email] sign-in code for ${email} (${purpose}): ${code}`);
    return;
  }
  const { logEvent } = await import("./events");
  await logEvent({ level: "error", kind: "email.unconfigured", message: "No email provider configured; sign-in code not sent." });
  throw new Error("Email is not set up on this deployment.");
}
