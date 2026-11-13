"use server";
// Everything a signed-in person can do to a club. Each action re-checks who is
// asking; the club functions re-check that they're an organizer where it matters.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createClub, createInvite, deleteAccount, joinClub, leaveClub, makeOrganizer, removeMember, revokeInvite, setExperience, updateProfile, updateSettings,
} from "@/clubs/clubs";
import { requireUser } from "@/lib/session";

const str = (f: FormData, key: string) => String(f.get(key) ?? "");
// The settings form speaks in percents and days; the game stores fractions.
const pct = (f: FormData, key: string) => (str(f, key) === "" ? undefined : Number(str(f, key)) / 100);
const settingsFrom = (f: FormData) => ({
  minHoldDays: str(f, "minHoldDays"),
  capAtPurchase: pct(f, "capAtPurchase"),
  feeRate: pct(f, "feeRate"),
  shortTermTaxRate: pct(f, "shortTermTaxRate"),
  longTermTaxRate: pct(f, "longTermTaxRate"),
});

export async function startClub(f: FormData) {
  const me = await requireUser("/clubs/new");
  await setExperience(me.id, str(f, "experience"));
  const { club } = await createClub(me.id, {
    name: str(f, "name"),
    displayName: str(f, "displayName"),
    avatar: str(f, "avatar"),
    plays: str(f, "plays") !== "no",
    settings: settingsFrom(f),
  });
  redirect(`/clubs/${club.id}`);
}

export async function join(f: FormData) {
  const code = str(f, "code");
  const me = await requireUser(`/join/${code}`);
  await setExperience(me.id, str(f, "experience"));
  const membership = await joinClub(me.id, code, { displayName: str(f, "displayName"), avatar: str(f, "avatar") });
  redirect(`/clubs/${membership.clubId}`);
}

export async function newInvite(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await createInvite(me.id, clubId);
  revalidatePath(`/clubs/${clubId}`);
}

export async function turnOffInvite(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await revokeInvite(me.id, clubId, str(f, "inviteId"));
  revalidatePath(`/clubs/${clubId}`);
}

export async function saveSettings(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await updateSettings(me.id, clubId, settingsFrom(f), str(f, "name"));
  revalidatePath(`/clubs/${clubId}`);
}

export async function promote(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await makeOrganizer(me.id, clubId, str(f, "membershipId"));
  revalidatePath(`/clubs/${clubId}`);
}

export async function saveProfile(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await updateProfile(str(f, "membershipId"), me.id, { displayName: str(f, "displayName"), avatar: str(f, "avatar") });
  revalidatePath(`/clubs/${clubId}`);
}

export async function saveExperience(f: FormData) {
  const me = await requireUser("/me");
  await setExperience(me.id, str(f, "experience"));
  revalidatePath("/me");
}

// These three can be refused (a club needs an organizer); the reason goes back
// to the page in the address so it shows without JavaScript.
const reason = (err: unknown) => encodeURIComponent(err instanceof Error ? err.message : "That didn't work");

export async function remove(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  await removeMember(me.id, clubId, str(f, "membershipId"));
  revalidatePath(`/clubs/${clubId}`);
}

export async function leave(f: FormData) {
  const clubId = str(f, "clubId");
  const me = await requireUser(`/clubs/${clubId}`);
  if (str(f, "sure") !== "yes") redirect(`/clubs/${clubId}`);
  let problem = "";
  try {
    await leaveClub(me.id, clubId);
  } catch (err) {
    problem = reason(err);
  }
  redirect(problem ? `/clubs/${clubId}?problem=${problem}` : "/clubs");
}

export async function deleteMe(f: FormData) {
  const me = await requireUser("/me");
  if (str(f, "sure") !== "yes") redirect("/me");
  let problem = "";
  try {
    await deleteAccount(me.id);
  } catch (err) {
    problem = reason(err);
  }
  redirect(problem ? `/me?problem=${problem}` : "/");
}
