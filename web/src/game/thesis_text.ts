// The words around a thesis: its three parts, the prediction choices and the
// helpers that turn chat answers into a starting draft. Pure, so the thesis
// screen (in the browser) and the server's checks share one copy.
//
// A thesis has three parts (concept doc, "The first 15 minutes"): what the
// business does well, what happens next, and the number being watched. Each is
// free text, never a menu: concepts are marked "applied" from what's written,
// and a template mustn't earn that for the player.
import { PE_SHOWN_UP_TO } from "@/lib/format";

export type Parts = [string, string, string];
export type PredictionMetric = "revenue_growth" | "eps" | "margin";

// Measurable metrics only, so predictions grade objectively at earnings.
export const METRICS: { id: PredictionMetric; label: string; unit: "%" | "$"; step: number; fallback: number; min: number; max: number }[] = [
  { id: "revenue_growth", label: "Sales growth vs. a year ago", unit: "%", step: 1, fallback: 5, min: -100, max: 1000 },
  { id: "eps", label: "Profit per share next quarter (3 months)", unit: "$", step: 0.05, fallback: 1, min: -1000, max: 10000 },
  { id: "margin", label: "Profit per $1 of sales next quarter", unit: "%", step: 1, fallback: 10, min: -500, max: 100 },
];
export const metricById = (id: string) => METRICS.find((m) => m.id === id);
export const fmtPrediction = (unit: string, v: number) => (unit === "$" ? `$${v.toFixed(2)}` : `${v.toFixed(0)}%`);

/** The value a prediction stepper starts on: the last quarter's number, rounded to the metric's step. */
export function startingValue(id: PredictionMetric, ref: number | null): number {
  const m = metricById(id)!;
  if (ref == null) return m.fallback;
  return m.unit === "$" ? Math.round(ref * 20) / 20 : Math.round(ref);
}

export const MIN_PART = 6; // characters per part: enough to rule out a blank, short enough not to nag
export const MAX_PART = 600;

export const SLOT_LABELS: { label: string; hint: string }[] = [
  { label: "What they do well", hint: "The thing about this business that’s hard to copy." },
  { label: "What I think happens next", hint: "And why. This is the part your club will argue with." },
  { label: "The number I’m watching", hint: "Say the number and what it means. This is what counts for your rank." },
];

// What the starters are built from: numbers the player can see on the company page.
export type StarterFacts = { name: string; pe: number | null; netIncomeTtm: number | null; revenueGrowth: number | null; netMargin: number | null };

/** Openings for the third part. Each ends mid-sentence: the player has to finish the thought. */
export function numberStarters(c: StarterFacts): string[] {
  const out: string[] = [];
  const losing = c.netIncomeTtm != null && c.netIncomeTtm <= 0;
  if (c.pe != null) out.push(c.pe > PE_SHOWN_UP_TO ? `The P/E is over ${PE_SHOWN_UP_TO}, which means ` : `The P/E is ${c.pe.toFixed(0)}, which means `);
  else if (losing) out.push(`${c.name} lost money over the last 12 months, so `);
  if (c.revenueGrowth != null) {
    const g = Math.round(Math.abs(c.revenueGrowth));
    if (losing && c.revenueGrowth > 0) out.push(`Its sales are growing ${g}% while it loses money, so `);
    else out.push(c.revenueGrowth >= 0 ? `Sales grew ${g}% over the last 12 months, so ` : `Sales shrank ${g}% over the last 12 months, so `);
  }
  if (!losing && c.netMargin != null && c.netMargin > 0) out.push(`It keeps ${Math.round(c.netMargin)}¢ of each $1 of sales, which `);
  return out;
}

/**
 * Whether a part has something of the player's own in it. A starter on its
 * own ("The P/E is 45, which means") doesn't count for the third part, or a
 * tap would be enough to use a concept.
 */
export function written(parts: Parts, i: number, starters: string[]): boolean {
  const v = parts[i].trim();
  const starter = i === 2 ? starters.map((s) => s.trim()).find((s) => v.startsWith(s)) : undefined;
  return v.length - (starter?.length ?? 0) >= MIN_PART;
}

const capFirst = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
// Keep "I" and acronyms like "AI" capitalized.
const lowerFirst = (t: string) => (/^(I\b|[A-Z]{2})/.test(t) ? t : t.charAt(0).toLowerCase() + t.slice(1));
export const endStop = (t: string) => (/[.!?…]$/.test(t) ? t : t + ".");
const skipAnswer = (t: string) => /^(not sure|yes|no|maybe|about|what does|idk|dunno)/i.test(t);

/**
 * A draft from the player's own chat answers, so the thesis builds on the
 * coach conversation instead of starting over. Only the player's words go in,
 * never the coach's: the "why" answer is what the business does well, the
 * "how could it beat expectations" answer is what happens next.
 */
export function partsFromChat(answers: string[]): Parts {
  const [why, , how] = answers;
  const p: Parts = ["", "", ""];
  if (why && !skipAnswer(why)) p[0] = endStop(capFirst(why));
  if (how && !skipAnswer(how)) p[1] = `It could do better than buyers think if ${endStop(lowerFirst(how))}`;
  return p;
}

/** The thesis as one paragraph, the way clubmates read it. */
export const joinParts = (p: readonly string[]) =>
  p
    .map((t) => t.trim())
    .filter(Boolean)
    .map(endStop)
    .join(" ");

export { capFirst };
