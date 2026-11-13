// Clubs, memberships, invite links and the Agree click. Everything a page or
// a server action does to these tables goes through here, so the access rule
// ("a player sees only their own club") lives in one place.
import { randomInt } from "node:crypto";
import { and, asc, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/db";
import { agreements, clubs, invites, memberships, user } from "@/db/schema";
import type { GameSettings } from "@/lib/rules";
import { cleanSettings } from "./settings";

// Bump when the Terms or the Privacy Policy change; everyone is asked to agree again.
export const TERMS_VERSION = "2026-11-12";

export const EXPERIENCE_LEVELS = ["new", "some", "lots"] as const;
export type Experience = (typeof EXPERIENCE_LEVELS)[number];

export const AVATARS = ["🎧", "🦊", "🐢", "🚀", "🌵", "🎸", "🐙", "⚽", "🧩", "🦉", "🍕", "🛹", "🌊", "🔭", "🎲", "🦖"];

export type Membership = typeof memberships.$inferSelect;
export type Club = typeof clubs.$inferSelect;

const cleanName = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
const cleanAvatar = (s: string | undefined) => (s && AVATARS.includes(s) ? s : AVATARS[0]);

// ---- The Agree click ----

export async function hasAgreed(userId: string) {
  const [row] = await db
    .select({ id: agreements.id })
    .from(agreements)
    .where(and(eq(agreements.userId, userId), eq(agreements.termsVersion, TERMS_VERSION)));
  return !!row;
}

export async function recordAgreement(userId: string) {
  await db.insert(agreements).values({ userId, termsVersion: TERMS_VERSION }).onConflictDoNothing();
}

export async function setExperience(userId: string, experience: string) {
  if (!EXPERIENCE_LEVELS.includes(experience as Experience)) throw new Error("Unknown experience level");
  await db.update(user).set({ experience }).where(eq(user.id, userId));
}

// ---- Clubs and memberships ----

export async function createClub(
  userId: string,
  input: { name: string; displayName: string; avatar?: string; plays: boolean; settings?: Partial<Record<keyof GameSettings, unknown>> },
) {
  const name = cleanName(input.name, 60);
  const displayName = cleanName(input.displayName, 30);
  if (!name) throw new Error("A club needs a name");
  if (!displayName) throw new Error("You need a name in the club");
  return db.transaction(async (tx) => {
    const [club] = await tx.insert(clubs).values({ name, createdBy: userId, settings: cleanSettings(input.settings) }).returning();
    const [membership] = await tx
      .insert(memberships)
      .values({ clubId: club.id, userId, displayName, avatar: cleanAvatar(input.avatar), role: "organizer", plays: input.plays })
      .returning();
    return { club, membership };
  });
}

/** The person's memberships with their clubs, oldest first. */
export async function membershipsOf(userId: string) {
  return db
    .select({ membership: memberships, club: clubs })
    .from(memberships)
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(eq(memberships.userId, userId))
    .orderBy(asc(memberships.joinedAt));
}

/** The person's membership in this club, or null: the gate on every club page. */
export async function membershipIn(userId: string, clubId: string) {
  const [row] = await db
    .select({ membership: memberships, club: clubs })
    .from(memberships)
    .innerJoin(clubs, eq(clubs.id, memberships.clubId))
    .where(and(eq(memberships.userId, userId), eq(memberships.clubId, clubId)));
  return row ?? null;
}

export async function roster(clubId: string) {
  return db.select().from(memberships).where(eq(memberships.clubId, clubId)).orderBy(asc(memberships.joinedAt));
}

export async function updateProfile(membershipId: string, userId: string, input: { displayName: string; avatar?: string }) {
  const displayName = cleanName(input.displayName, 30);
  if (!displayName) throw new Error("You need a name in the club");
  await db
    .update(memberships)
    .set({ displayName, avatar: cleanAvatar(input.avatar) })
    .where(and(eq(memberships.id, membershipId), eq(memberships.userId, userId)));
}

async function requireOrganizer(userId: string, clubId: string) {
  const mine = await membershipIn(userId, clubId);
  if (mine?.membership.role !== "organizer") throw new Error("Only a club organizer can do that");
  return mine;
}

export async function updateSettings(userId: string, clubId: string, input: Partial<Record<keyof GameSettings, unknown>>, name?: string) {
  const { club } = await requireOrganizer(userId, clubId);
  const newName = name == null ? club.name : cleanName(name, 60) || club.name;
  await db
    .update(clubs)
    .set({ settings: cleanSettings({ ...club.settings, ...input }), name: newName })
    .where(eq(clubs.id, clubId));
}

/** A club can have more than one organizer; any organizer can add one. */
export async function makeOrganizer(userId: string, clubId: string, membershipId: string) {
  await requireOrganizer(userId, clubId);
  await db
    .update(memberships)
    .set({ role: "organizer" })
    .where(and(eq(memberships.id, membershipId), eq(memberships.clubId, clubId)));
}

// ---- Leaving, removing and deleting ----
//
// A membership is the player, so deleting it deletes that player's game data
// in the club (the tables that hang off it cascade). A club with members
// always keeps an organizer; the last person out takes the club with them.

async function othersIn(clubId: string, membershipId: string) {
  return db
    .select({ id: memberships.id, role: memberships.role })
    .from(memberships)
    .where(and(eq(memberships.clubId, clubId), ne(memberships.id, membershipId)));
}

const NEEDS_ORGANIZER = "Make someone else an organizer first: a club needs one";

/** Leave a club. The last person to leave deletes the club. */
export async function leaveClub(userId: string, clubId: string) {
  const mine = await membershipIn(userId, clubId);
  if (!mine) return;
  const others = await othersIn(clubId, mine.membership.id);
  if (!others.length) {
    await db.delete(clubs).where(eq(clubs.id, clubId));
    return;
  }
  if (mine.membership.role === "organizer" && !others.some((o) => o.role === "organizer")) throw new Error(NEEDS_ORGANIZER);
  await db.delete(memberships).where(eq(memberships.id, mine.membership.id));
}

/** An organizer removes someone else from the club, with their data in it. */
export async function removeMember(userId: string, clubId: string, membershipId: string) {
  const mine = await requireOrganizer(userId, clubId);
  if (mine.membership.id === membershipId) throw new Error("To take yourself out, leave the club");
  await db.delete(memberships).where(and(eq(memberships.id, membershipId), eq(memberships.clubId, clubId)));
}

/**
 * Deletes the person: their sign-in, their memberships and everything under
 * them. Refused while they are the only organizer of a club other people are in.
 */
export async function deleteAccount(userId: string) {
  const mine = await membershipsOf(userId);
  const alone: string[] = [];
  for (const { membership, club } of mine) {
    const others = await othersIn(club.id, membership.id);
    if (!others.length) alone.push(club.id);
    else if (membership.role === "organizer" && !others.some((o) => o.role === "organizer")) {
      throw new Error(`${NEEDS_ORGANIZER} (${club.name})`);
    }
  }
  await db.transaction(async (tx) => {
    for (const clubId of alone) await tx.delete(clubs).where(eq(clubs.id, clubId));
    await tx.delete(user).where(eq(user.id, userId));
  });
}

// ---- Invite links ----

const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no look-alikes (0/o, 1/l/i)
const newCode = () => Array.from({ length: 12 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
export const INVITE_DAYS = 14;

export async function createInvite(userId: string, clubId: string, now = new Date()) {
  await requireOrganizer(userId, clubId);
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000);
  const [invite] = await db.insert(invites).values({ clubId, code: newCode(), createdBy: userId, expiresAt }).returning();
  return invite;
}

export async function revokeInvite(userId: string, clubId: string, inviteId: string) {
  await requireOrganizer(userId, clubId);
  await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.clubId, clubId)));
}

const live = (now: Date) => and(isNull(invites.revokedAt), gt(invites.expiresAt, now));

export async function liveInvites(clubId: string, now = new Date()) {
  return db
    .select()
    .from(invites)
    .where(and(eq(invites.clubId, clubId), live(now)))
    .orderBy(desc(invites.createdAt));
}

/** The club behind a link that still works, or null. Safe to show signed out: name only. */
export async function findInvite(code: string, now = new Date()) {
  const [row] = await db
    .select({ invite: invites, club: clubs })
    .from(invites)
    .innerJoin(clubs, eq(clubs.id, invites.clubId))
    .where(and(eq(invites.code, code.toLowerCase().trim()), live(now)));
  return row ?? null;
}

/** Joins through a link. Joining a club you're already in returns that membership unchanged. */
export async function joinClub(userId: string, code: string, input: { displayName: string; avatar?: string }, now = new Date()) {
  const found = await findInvite(code, now);
  if (!found) throw new Error("That invite link has expired or been turned off");
  const existing = await membershipIn(userId, found.club.id);
  if (existing) return existing.membership;
  const displayName = cleanName(input.displayName, 30);
  if (!displayName) throw new Error("You need a name in the club");
  const [membership] = await db
    .insert(memberships)
    .values({ clubId: found.club.id, userId, displayName, avatar: cleanAvatar(input.avatar), role: "member", plays: true, inviteId: found.invite.id })
    .returning();
  return membership;
}
