// The club's page: who's in it, the invite link and the rules. The portfolio,
// board and feed land here in the next phases.
import Link from "next/link";
import { notFound } from "next/navigation";
import { canManageClub } from "@/clubs/access";
import { INVITE_DAYS, liveInvites, membershipIn, roster } from "@/clubs/clubs";
import { baseURL } from "@/lib/auth_options";
import { requireUser } from "@/lib/session";
import { AvatarPicker } from "../../components/pickers";
import { SettingsFields } from "../../components/settings_fields";
import { newInvite, promote, saveProfile, saveSettings, turnOffInvite } from "../actions";

export const dynamic = "force-dynamic";

const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const pct = (n: number) => `${Math.round(n * 10000) / 100}%`;

export default async function ClubPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser(`/clubs/${id}`);
  const mine = await membershipIn(me.id, id);
  if (!mine) notFound(); // not your club: it doesn't exist as far as you can tell
  const { club, membership } = mine;
  const organizer = canManageClub(membership);
  const [members, invites] = await Promise.all([roster(club.id), organizer ? liveInvites(club.id) : []]);
  const s = club.settings;

  return (
    <main className="status">
      <div className="topnav">
        <Link href="/clubs">← Your clubs</Link>
        <Link href="/me">Me</Link>
      </div>
      <h1>{club.name}</h1>
      <p className="sub">
        {members.length === 1 ? "Just you so far." : `${members.length} people.`} The game itself (picks, portfolios, the board) is being built; this is the club
        and its rules.
      </p>

      <section className="card">
        <h2>Who&apos;s in</h2>
        <ul className="roster">
          {members.map((m) => (
            <li key={m.id}>
              <span className="face">{m.avatar}</span>
              <span className="who">
                {m.displayName}
                {m.id === membership.id && <span className="tag">you</span>}
                {m.role === "organizer" && <span className="tag">organizer</span>}
                {!m.plays && <span className="tag">not playing</span>}
              </span>
              {organizer && m.role !== "organizer" && (
                <form action={promote}>
                  <input type="hidden" name="clubId" value={club.id} />
                  <input type="hidden" name="membershipId" value={m.id} />
                  <button className="button quiet">Make organizer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      {organizer && (
        <section className="card stack">
          <h2>Invite link</h2>
          {invites.length === 0 && <p>No link is on right now. Make one and send it to the people you want in the club.</p>}
          {invites.map((inv) => (
            <div key={inv.id} className="stack">
              <input className="linkbox" readOnly value={`${baseURL}/join/${inv.code}`} aria-label="Invite link" />
              <p className="muted small">
                Anyone with this link can join until {day(inv.expiresAt)}. Send it only to people you want in the club.
              </p>
              <form action={turnOffInvite}>
                <input type="hidden" name="clubId" value={club.id} />
                <input type="hidden" name="inviteId" value={inv.id} />
                <button className="button quiet">Turn this link off</button>
              </form>
            </div>
          ))}
          <form action={newInvite}>
            <input type="hidden" name="clubId" value={club.id} />
            <button className="button secondary">{invites.length ? "Make another link" : "Make an invite link"}</button>
          </form>
          <p className="muted small">A link works for {INVITE_DAYS} days.</p>
        </section>
      )}

      <section className="card">
        <h2>Rules in this club</h2>
        <dl>
          <dt>Minimum hold before selling a pick</dt>
          <dd>{s.minHoldDays} days</dd>
          <dt>Biggest single purchase</dt>
          <dd>{pct(s.capAtPurchase)} of your portfolio</dd>
          <dt>Fee per trade</dt>
          <dd>{pct(s.feeRate)}</dd>
          <dt>Tax on gains held under 6 months</dt>
          <dd>{pct(s.shortTermTaxRate)}</dd>
          <dt>Tax on gains held 6 months or more</dt>
          <dd>{pct(s.longTermTaxRate)}</dd>
        </dl>
        {organizer && (
          <details style={{ marginTop: 12 }}>
            <summary>Change the club&apos;s name or rules</summary>
            <form action={saveSettings} className="stack" style={{ marginTop: 12 }}>
              <input type="hidden" name="clubId" value={club.id} />
              <label className="field">
                Club name
                <input type="text" name="name" maxLength={60} defaultValue={club.name} required />
              </label>
              <SettingsFields settings={s} />
              <button className="button">Save</button>
            </form>
          </details>
        )}
      </section>

      <section className="card">
        <h2>You in this club</h2>
        <form action={saveProfile} className="stack">
          <input type="hidden" name="clubId" value={club.id} />
          <input type="hidden" name="membershipId" value={membership.id} />
          <label className="field">
            Your name in the club
            <input type="text" name="displayName" maxLength={30} defaultValue={membership.displayName} required />
          </label>
          <AvatarPicker value={membership.avatar} />
          <button className="button secondary">Save</button>
        </form>
      </section>
    </main>
  );
}
