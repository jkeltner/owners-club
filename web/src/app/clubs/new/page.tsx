// Anyone 13 or older can start a club and becomes its organizer.
import Link from "next/link";
import { DEFAULT_SETTINGS } from "@/lib/rules";
import { requireUser } from "@/lib/session";
import { AvatarPicker, ExperiencePicker } from "../../components/pickers";
import { SettingsFields } from "../../components/settings_fields";
import { startClub } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewClub() {
  const me = await requireUser("/clubs/new");
  const experience = (me as { experience?: string | null }).experience;
  return (
    <main className="status">
      <div className="topnav">
        <Link href="/clubs">← Your clubs</Link>
      </div>
      <h1>Start a club</h1>
      <p className="sub">You&apos;ll be the organizer: you invite people and set the rules. You can add more organizers later.</p>
      <form action={startClub} className="stack">
        <section className="card stack">
          <label className="field">
            Club name
            <input type="text" name="name" maxLength={60} required placeholder="The Lunch Table Fund" />
          </label>
          <label className="field">
            Your name in the club
            <input type="text" name="displayName" maxLength={30} required defaultValue={me.name?.split(" ")[0] ?? ""} />
            <small>What clubmates see. A first name or nickname is plenty.</small>
          </label>
          <AvatarPicker />
        </section>

        <section className="card stack">
          <fieldset className="picker">
            <legend>Will you play too?</legend>
            <div className="choices">
              <label>
                <input type="radio" name="plays" value="yes" defaultChecked />
                <span>
                  <b>Yes, I&apos;m playing</b>
                  <small>You get a portfolio and see clubmates the way any player does: their holdings as shares, a week late.</small>
                </span>
              </label>
              <label>
                <input type="radio" name="plays" value="no" />
                <span>
                  <b>No, I&apos;m only running it</b>
                  <small>For a teacher or a parent. No portfolio; you see every player&apos;s holdings and trades in dollars as they happen.</small>
                </span>
              </label>
            </div>
          </fieldset>
        </section>

        <section className="card stack">
          <ExperiencePicker value={experience} />
        </section>

        <details className="card">
          <summary>
            <b>Game rules</b> <span className="muted small">(the usual ones are filled in; change them only if you mean to)</span>
          </summary>
          <div className="stack" style={{ marginTop: 12 }}>
            <SettingsFields settings={DEFAULT_SETTINGS} />
          </div>
        </details>

        <button className="button">Start the club</button>
      </form>
    </main>
  );
}
