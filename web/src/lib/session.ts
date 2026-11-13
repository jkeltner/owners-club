import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hasAgreed } from "@/clubs/clubs";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
}

/** Only ever send someone to a path on this site. */
export const safeNext = (next: string | null | undefined, fallback = "/") => (next && /^\/(?!\/)/.test(next) ? next : fallback);

/**
 * The signed-in person, for any page a player uses. Signed out goes to
 * sign-in; signed in without the Agree click (13 or older, Terms, Privacy)
 * goes to the Agree page. Both come back to `next`.
 */
export async function requireUser(next: string) {
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  if (!(await hasAgreed(session.user.id))) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  return session.user;
}

const adminEmails = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined) => !!email && adminEmails().includes(email.toLowerCase());
