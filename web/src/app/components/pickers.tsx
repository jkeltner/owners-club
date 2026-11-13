// Form pieces shared by "start a club", "join" and the profile. Plain radio
// inputs: they work without any script on the page.
import { AVATARS } from "@/clubs/clubs";
import { EXPERIENCE } from "@/clubs/experience";

export function AvatarPicker({ value }: { value?: string }) {
  const chosen = value && AVATARS.includes(value) ? value : AVATARS[0];
  return (
    <fieldset className="picker">
      <legend>Pick an avatar</legend>
      <div className="avatars">
        {AVATARS.map((a) => (
          <label key={a}>
            <input type="radio" name="avatar" value={a} defaultChecked={a === chosen} />
            <span>{a}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function ExperiencePicker({ value }: { value?: string | null }) {
  return (
    <fieldset className="picker">
      <legend>How much do you know about stocks?</legend>
      <p className="muted small">There&apos;s no wrong answer. It sets how much the coach explains. You can change it later.</p>
      <div className="choices">
        {EXPERIENCE.map((e) => (
          <label key={e.id}>
            <input type="radio" name="experience" value={e.id} defaultChecked={e.id === value} required />
            <span>
              <b>
                {e.icon} {e.label}
              </b>
              <small>{e.detail}</small>
              <small className="muted">{e.changes}</small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
