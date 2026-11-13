import { beforeAll, describe, expect, it } from "vitest";
import { db, dbReady } from "@/db";
import { agreements, clubs, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { seesDollars, viewOf } from "@/clubs/access";
import {
  createClub, createInvite, deleteAccount, findInvite, leaveClub, removeMember, hasAgreed, joinClub, liveInvites, makeOrganizer, membershipIn, membershipsOf,
  recordAgreement, revokeInvite, roster, setExperience, updateProfile, updateSettings,
} from "@/clubs/clubs";
import { cleanSettings } from "@/clubs/settings";
import { DEFAULT_SETTINGS } from "@/lib/rules";

// Invented people.
const people = ["ana", "bo", "cy", "dee"];

describe("clubs", () => {
  beforeAll(async () => {
    await dbReady;
    await db.insert(user).values(people.map((p) => ({ id: p, name: p, email: `${p}@example.test` })));
  });

  it("records the Agree click once per terms version", async () => {
    expect(await hasAgreed("ana")).toBe(false);
    await recordAgreement("ana");
    await recordAgreement("ana");
    expect(await hasAgreed("ana")).toBe(true);
    expect(await hasAgreed("bo")).toBe(false);
  });

  it("makes the creator an organizer with the default rules", async () => {
    const { club, membership } = await createClub("ana", { name: "  Lunch   Table ", displayName: "Ana", plays: true });
    expect(club.name).toBe("Lunch Table");
    expect(club.settings).toEqual(DEFAULT_SETTINGS);
    expect(membership.role).toBe("organizer");
    expect(membership.plays).toBe(true);
  });

  it("lets a club shorten the hold, inside limits", async () => {
    const { club } = await createClub("ana", { name: "Beta", displayName: "Ana", plays: false, settings: { minHoldDays: "14" } });
    expect(club.settings.minHoldDays).toBe(14);
    expect(club.settings.feeRate).toBe(DEFAULT_SETTINGS.feeRate);
    expect(cleanSettings({ minHoldDays: 9999, capAtPurchase: 0, feeRate: "abc" })).toEqual({ ...DEFAULT_SETTINGS, minHoldDays: 365, capAtPurchase: 0.05 });
  });

  it("joins through a live link, once, as a playing member", async () => {
    const { club } = await createClub("ana", { name: "Joiners", displayName: "Ana", plays: true });
    const invite = await createInvite("ana", club.id);
    expect((await findInvite(invite.code.toUpperCase()))?.club.name).toBe("Joiners");
    const m = await joinClub("bo", invite.code, { displayName: "Bo", avatar: "🦊" });
    expect(m).toMatchObject({ role: "member", plays: true, avatar: "🦊", inviteId: invite.id });
    const again = await joinClub("bo", invite.code, { displayName: "Someone else" });
    expect(again.id).toBe(m.id);
    expect((await roster(club.id)).map((r) => r.displayName)).toEqual(["Ana", "Bo"]);
  });

  it("refuses an expired or revoked link", async () => {
    const { club } = await createClub("ana", { name: "Closed", displayName: "Ana", plays: true });
    const old = await createInvite("ana", club.id, new Date("2026-01-01"));
    await expect(joinClub("cy", old.code, { displayName: "Cy" })).rejects.toThrow(/expired/);
    const invite = await createInvite("ana", club.id);
    await revokeInvite("ana", club.id, invite.id);
    expect(await findInvite(invite.code)).toBeNull();
    expect(await liveInvites(club.id)).toHaveLength(0);
  });

  it("keeps organizer actions to organizers, and a club to its members", async () => {
    const { club } = await createClub("ana", { name: "Rules", displayName: "Ana", plays: true });
    const invite = await createInvite("ana", club.id);
    const bo = await joinClub("bo", invite.code, { displayName: "Bo" });
    await expect(createInvite("bo", club.id)).rejects.toThrow(/organizer/);
    await expect(updateSettings("bo", club.id, { minHoldDays: 1 })).rejects.toThrow(/organizer/);
    await expect(createInvite("cy", club.id)).rejects.toThrow(/organizer/);
    expect(await membershipIn("cy", club.id)).toBeNull();
    await makeOrganizer("ana", club.id, bo.id);
    await updateSettings("bo", club.id, { minHoldDays: 30 }, "New name");
    const mine = await membershipIn("ana", club.id);
    expect(mine?.club.settings.minHoldDays).toBe(30);
    expect(mine?.club.name).toBe("New name");
  });

  it("gives one person a separate membership per club", async () => {
    const a = await createClub("dee", { name: "One", displayName: "Dee", plays: true });
    const b = await createClub("dee", { name: "Two", displayName: "D", plays: false });
    const mine = await membershipsOf("dee");
    expect(mine.map((m) => m.club.name)).toEqual(["One", "Two"]);
    expect(a.membership.id).not.toBe(b.membership.id);
    await updateProfile(a.membership.id, "dee", { displayName: "Dee Dee", avatar: "not an avatar" });
    await updateProfile(a.membership.id, "ana", { displayName: "Hacked" });
    const after = await membershipIn("dee", a.club.id);
    expect(after?.membership.displayName).toBe("Dee Dee");
    expect(after?.membership.avatar).toBe("🎧");
  });

  it("stores the experience answer on the person", async () => {
    await setExperience("dee", "some");
    await expect(setExperience("dee", "expert")).rejects.toThrow();
    const [row] = await db.select().from(user).where((await import("drizzle-orm")).eq(user.id, "dee"));
    expect(row.experience).toBe("some");
  });
});

describe("who sees what", () => {
  const player = { id: "m1", clubId: "c1", role: "member" as const, plays: true };
  const mate = { id: "m2", clubId: "c1" };
  it("shows dollars only to yourself and to organizers who don't play", () => {
    expect(viewOf(player, player)).toBe("own");
    expect(viewOf(player, mate)).toBe("clubmate");
    expect(viewOf({ ...player, role: "organizer", plays: false }, mate)).toBe("organizer");
    expect(viewOf({ ...player, role: "organizer", plays: true }, mate)).toBe("clubmate");
    expect(viewOf(player, { id: "m9", clubId: "c2" })).toBe("none");
    expect(viewOf(null, mate)).toBe("none");
    expect(seesDollars("own")).toBe(true);
    expect(seesDollars("organizer")).toBe(true);
    expect(seesDollars("clubmate")).toBe(false);
  });

  it("lets people leave, organizers remove, and anyone delete their account", async () => {
    await db.insert(user).values(["eli", "fay", "gus"].map((p) => ({ id: p, name: p, email: `${p}@example.test` })));
    await recordAgreement("fay");
    const { club } = await createClub("eli", { name: "Bus Stop", displayName: "Eli", plays: true });
    const invite = await createInvite("eli", club.id);
    const fay = await joinClub("fay", invite.code, { displayName: "Fay" });
    const gus = await joinClub("gus", invite.code, { displayName: "Gus" });

    // A member can't remove anyone; an organizer can, but not themselves.
    await expect(removeMember("fay", club.id, gus.id)).rejects.toThrow(/organizer/);
    const eli = (await membershipIn("eli", club.id))!.membership;
    await expect(removeMember("eli", club.id, eli.id)).rejects.toThrow(/leave/);
    await removeMember("eli", club.id, gus.id);
    expect(await membershipIn("gus", club.id)).toBeNull();

    // The only organizer can't walk out on the others, or delete their account.
    await expect(leaveClub("eli", club.id)).rejects.toThrow(/organizer first/);
    await expect(deleteAccount("eli")).rejects.toThrow(/Bus Stop/);
    expect(await membershipIn("eli", club.id)).not.toBeNull();

    // Once there's another organizer, they can.
    await makeOrganizer("eli", club.id, fay.id);
    await leaveClub("eli", club.id);
    expect((await roster(club.id)).map((m) => m.displayName)).toEqual(["Fay"]);

    // Deleting the account takes the sign-in, the Agree record and, as the last one in, the club.
    await deleteAccount("fay");
    expect(await db.select().from(user).where(eq(user.id, "fay"))).toHaveLength(0);
    expect(await db.select().from(agreements).where(eq(agreements.userId, "fay"))).toHaveLength(0);
    expect(await db.select().from(clubs).where(eq(clubs.id, club.id))).toHaveLength(0);
    expect(await findInvite(invite.code)).toBeNull();
  });
});
