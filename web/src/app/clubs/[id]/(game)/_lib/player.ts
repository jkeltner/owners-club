// The gate on every game screen: signed in, agreed, a member of this club and
// playing in it. Someone who isn't in the club gets a 404 (as far as they can
// tell it doesn't exist); an organizer who doesn't play goes to the club page.
import { notFound, redirect } from "next/navigation";
import { membershipIn } from "@/clubs/clubs";
import { requireUser } from "@/lib/session";

export async function requirePlayer(clubId: string, path: string) {
  const user = await requireUser(path);
  const mine = await membershipIn(user.id, clubId);
  if (!mine) notFound();
  if (!mine.membership.plays) redirect(`/clubs/${clubId}`);
  const experience = (user as { experience?: string | null }).experience ?? null;
  return { user, experience, club: mine.club, membership: mine.membership };
}

/** For screens the whole club reads (the board): anyone in the club, playing or only running it. */
export async function requireMember(clubId: string, path: string) {
  const user = await requireUser(path);
  const mine = await membershipIn(user.id, clubId);
  if (!mine) notFound();
  return { user, club: mine.club, membership: mine.membership };
}

export { clubPath, companyPath } from "./paths";
