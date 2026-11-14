"use client";
// The three parts and the prediction. Free text in every part, never a menu:
// the starter chips open a sentence the player has to finish, and a starter
// alone doesn't count as written (the server checks the same thing).
import { useActionState, useState } from "react";
import { capFirst, fmtPrediction, METRICS, metricById, partsFromChat, SLOT_LABELS, startingValue, written, type Parts, type PredictionMetric } from "@/game/thesis_text";
import { saveThesis, type FormState } from "../../../actions";

type Props = {
  clubId: string;
  ticker: string;
  name: string;
  answers: string[]; // what the player told the coach
  watch: string | null; // the point the coach said was worth watching
  starters: string[];
  refs: Record<string, number | null>; // last quarter's number for each prediction metric
  when: string; // when the prediction is checked
  draft: { parts: Parts; metric: string; value: number } | null;
};

export function ThesisForm({ clubId, ticker, name, answers, watch, starters, refs, when, draft }: Props) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveThesis, {});
  const [parts, setParts] = useState<Parts>(draft?.parts ?? ["", "", ""]);
  const [metricId, setMetricId] = useState<PredictionMetric>((draft && metricById(draft.metric)?.id) || METRICS[0].id);
  const metric = metricById(metricId)!;
  const [value, setValue] = useState<number>(draft?.value ?? startingValue(metricId, refs[metricId]));

  const missing = [0, 1, 2].filter((i) => !written(parts, i, starters));
  const ok = missing.length === 0;
  const setPart = (i: number, t: string) => setParts((p) => p.map((x, j) => (j === i ? t : x)) as Parts);
  const fillFrom = (from: Parts) => setParts((p) => p.map((x, i) => (x.trim() ? x : from[i])) as Parts);
  const pickMetric = (id: PredictionMetric) => {
    setMetricId(id);
    setValue(startingValue(id, refs[id]));
  };
  const placeholders = [`${name} is good at…`, "I think… because…", starters[0] ? `${starters[0].trim()}…` : "The number I'm watching is… because…"];
  // The third part's prompt is the point the coach said was worth watching.
  const thirdHint = watch ? `The coach said this was worth watching: ${capFirst(watch)}` : SLOT_LABELS[2].hint;

  return (
    <form action={action}>
      <input type="hidden" name="clubId" value={clubId} />
      <input type="hidden" name="ticker" value={ticker} />
      <input type="hidden" name="metric" value={metricId} />
      <input type="hidden" name="value" value={value} />

      {answers.length > 0 && (
        <section className="card chat-recap">
          <p className="eyebrow">What you told the coach</p>
          <ul>
            {answers.map((a, i) => (
              <li key={i}>&ldquo;{a}&rdquo;</li>
            ))}
          </ul>
          <button type="button" className="chip" onClick={() => fillFrom(partsFromChat(answers))}>
            ✍️ Start from my answers
          </button>
        </section>
      )}

      <div className="thesis-slots">
        {SLOT_LABELS.map((s, i) => (
          <label key={i} className={`slot ${written(parts, i, starters) ? "filled" : ""}`}>
            <span className="slot-label">
              <b>
                {i + 1}. {s.label}
              </b>
              <small>{i === 2 ? thirdHint : s.hint}</small>
            </span>
            <textarea name={`part${i}`} value={parts[i]} onChange={(e) => setPart(i, e.target.value)} rows={2} maxLength={600} placeholder={placeholders[i]} />
            {i === 2 && !parts[2].trim() && starters.length > 0 && (
              <span className="chips slot-chips">
                {starters.map((t) => (
                  <button key={t} type="button" className="chip" onClick={() => setPart(2, t)}>
                    {t.trim()}…
                  </button>
                ))}
              </span>
            )}
          </label>
        ))}
      </div>

      <h2>My prediction</h2>
      <p className="muted">
        Pick one number. When {name} reports its results {when}, we&apos;ll check whether you were right.
      </p>
      <div className="metric-list">
        {METRICS.map((m) => (
          <button key={m.id} type="button" className={`metric ${m.id === metricId ? "on" : ""}`} onClick={() => pickMetric(m.id)} aria-pressed={m.id === metricId}>
            <b>{m.label}</b>
            <small>{refs[m.id] != null ? `Last quarter: ${fmtPrediction(m.unit, refs[m.id]!)}` : "We don't have last quarter's number for this one"}</small>
          </button>
        ))}
      </div>
      <section className="card stepper-card">
        <button type="button" className="step" onClick={() => setValue((v) => +(v - metric.step).toFixed(2))} aria-label="Lower">
          −
        </button>
        <div className="step-value">
          <span>{fmtPrediction(metric.unit, value)}</span>
          <small>or more</small>
        </div>
        <button type="button" className="step" onClick={() => setValue((v) => +(v + metric.step).toFixed(2))} aria-label="Higher">
          +
        </button>
      </section>

      {state.problem && <p className="notice">{state.problem}</p>}
      <div className="sticky-cta">
        <button className="btn btn-primary" disabled={!ok || pending}>
          {!ok ? (missing.length === 1 && missing[0] === 2 ? "Add the number you’re watching" : `Fill in part ${missing[0] + 1}`) : "Next: how much?"}
        </button>
      </div>
    </form>
  );
}
