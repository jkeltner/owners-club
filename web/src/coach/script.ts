// The scripted coach, ported from the prototype (prototype/src/coach/coach.ts)
// and fed real numbers. It is the offline fallback and the test double for the
// live coach (phase 4), which takes the same context and returns the same
// shape. Pure: no database, no clock.
//
// Product rule: the coach asks questions and shows numbers. It never says a
// stock is good or bad, never tells a player what to buy, never blocks a trade.
//
// Voice: written for a smart 14-year-old with no investing background. Every
// term is explained the first time it's used, every number comes with
// something to compare it to, and the coach only points at numbers the player
// can see on the company's page.
import { concept } from "@/content";
import { bigUsd, PE_SHOWN_UP_TO } from "@/lib/format";
import type { ProgressLevel } from "@/lib/ranks";

export type ScriptedMode = "pick" | "private";
export type ChatMsg = { from: "coach" | "player"; text: string };

// The company as the coach sees it: the same numbers the company page shows.
// Dollar figures are whole dollars over the last four reported quarters.
export type CoachCompany = {
  name: string;
  isAi: boolean;
  pe: number | null;
  marketCap: number | null;
  revenueTtm: number | null;
  netIncomeTtm: number | null;
  revenueGrowth: number | null; // % vs. the four quarters before
  usualPe?: [number, number]; // the usual range for this kind of company
  kindPlural?: string; // "chipmakers", "software companies"
};

export type CoachContext = {
  mode: ScriptedMode;
  playerName: string;
  experience?: string | null; // "some" skips definitions; "lots" also asks harder questions
  company?: CoachCompany;
  marketPe: number | null; // a typical S&P 500 company's P/E today
  turn: number; // how many replies the coach has already given
  facts?: Record<string, string>; // the private-company script's lines
};

export type CoachReply = {
  bubbles: string[];
  chips?: string[];
  tickers?: string[]; // companies to show as tappable cards
  done?: boolean;
  marks?: { slug: string; level: ProgressLevel }[];
};

export function coachReply(ctx: CoachContext, input: string | null): CoachReply {
  return ctx.mode === "private" ? privateScript(ctx, input) : pickScript(ctx, input);
}

// ---------- reading the player's answer ----------

export type Intent = "hype" | "customer" | "momentum" | "unsure" | "confused" | "growth" | "contrarian" | "other";

export function classify(text: string): Intent {
  const t = text.toLowerCase();
  if (/what does|what's that|whats that|what is|what's a|confus|don'?t get|huh|mean\?/.test(t)) return "confused";
  if (/not sure|idk|dunno|no idea|\?$/.test(t)) return "unsure";
  if (/nothing|underrat|missing|people don'?t|nobody|no one|wrong/.test(t)) return "contrarian";
  if (/growth|grow|more sales|expand|bigger/.test(t)) return "growth";
  if (/going up|went up|keeps? (going|rising)|stock is up|price is up|moon|rocket/.test(t)) return "momentum";
  if (/\buse\b|love|buy|play|watch|eat|drink|wear|my phone|i have|we have|everyone has|shop/.test(t)) return "customer";
  if (/huge|ai\b|everyone|famous|popular|best|big|future|hype/.test(t)) return "hype";
  return "other";
}

// ---------- a pick ----------

const usd = (dollars: number) => bigUsd(dollars / 1e9);

// Where the company's P/E stands: a number on the scale, off the top of it,
// missing because the company lost money, or missing because we don't have a
// year of its profit yet.
type PeCase = "number" | "over" | "loss" | "unknown";
const peCase = (c: CoachCompany): PeCase =>
  c.pe != null ? (c.pe > PE_SHOWN_UP_TO ? "over" : "number") : c.netIncomeTtm != null && c.netIncomeTtm <= 0 ? "loss" : "unknown";

function pickScript(ctx: CoachContext, input: string | null): CoachReply {
  const c = ctx.company!;
  const kind = peCase(c);
  const peText = c.pe != null ? c.pe.toFixed(0) : "";
  const theme = c.isAi ? "AI" : c.name;
  const knowsBasics = ctx.experience === "some" || ctx.experience === "lots";
  const expert = ctx.experience === "lots";
  const typical = ctx.marketPe != null ? Math.round(ctx.marketPe) : null;
  // How the P/E sits against a typical company's: well above, well below, or
  // about the same (the bands the company page uses). Without today's market
  // P/E, 23 stands in for typical.
  const level = c.pe == null ? null : c.pe > (typical ?? 23) * 1.3 ? "high" : c.pe < (typical ?? 23) * 0.8 ? "low" : "typical";
  const high = level === "high";
  const compare = [
    typical != null ? `A typical S&P 500 company is about ${typical}` : "",
    c.usualPe && c.kindPlural ? `${typical != null ? "and " : ""}${typical != null ? c.kindPlural : cap(c.kindPlural)} are usually ${c.usualPe[0]} to ${c.usualPe[1]}` : "",
  ]
    .filter(Boolean)
    .join(", ");
  const compareSentence = compare ? `${compare}.` : "";
  const revenueWord = knowsBasics ? "Revenue" : "Revenue (all the money from customers)";
  const growth =
    c.revenueGrowth == null
      ? ""
      : c.revenueGrowth >= 0
        ? `${revenueWord} grew ${Math.round(c.revenueGrowth)}% over the last 12 months.`
        : `${revenueWord} shrank ${Math.round(-c.revenueGrowth)}% over the last 12 months.`;

  if (ctx.turn === 0) {
    return {
      bubbles: [
        expert
          ? `Hey ${ctx.playerName}! I'm your coach. I won't tell you what to buy. You know the basics, so I'll skip to the hard questions.`
          : `Hey ${ctx.playerName}! I'm your coach. I won't tell you what to buy. I ask questions so your pick has a real reason behind it.`,
        `So: why ${c.name}? What got you interested?`,
      ],
      chips: [c.isAi ? "AI is huge" : `Everyone knows ${c.name}`, "I use their stuff", "The stock keeps going up", "Not sure yet"],
      marks: [{ slug: "market-cap-vs-share-price", level: "encountered" }],
    };
  }

  if (ctx.turn === 1) {
    // The signature move: what does the price already assume? (Or why P/E doesn't apply.)
    const whole = c.marketCap != null ? `Buyers still pay ${usd(c.marketCap)} for the whole company.` : "Buyers still pay for the whole company.";
    const pricedIn: Record<PeCase, string> = {
      loss: `${c.name} lost ${usd(-c.netIncomeTtm!)} over the last 12 months, so it has no P/E: there's no profit to divide by. ${whole} What are they expecting to happen?`,
      unknown: `I can't show you ${c.name}'s P/E yet (the price divided by a year of profit): I'm missing one of the numbers behind it. ${whole} What do you think they expect it to earn?`,
      over: knowsBasics
        ? `${c.name}'s P/E is over 100: its profit over the last 12 months was very small compared with its price. ${compareSentence} Either buyers expect profit to grow a lot, or something unusual shrank this year's profit. Which do you think it is?`
        : `Here's one way to see it. A stock's price divided by a year of the company's profit is called the P/E. ${c.name}'s is over 100: its profit over the last 12 months was very small compared with its price. ${compareSentence} Either buyers expect profit to grow a lot, or something unusual shrank this year's profit. Which do you think it is?`,
      number: knowsBasics
        ? `${c.name}'s P/E is ${peText}: the stock costs ${peText} times the last 12 months of profit. ${compareSentence} What growth is that price already counting on?`
        : `Here's one way to see it. ${c.name}'s stock costs about ${peText} times what the company earned over the last 12 months. That number is called the P/E. ${compareSentence} So what are buyers expecting that makes them pay ${high ? "that much" : "that"}?`,
    };
    const chips: Record<PeCase, string[]> = {
      loss: ["It makes money again", "What does that mean?", "Maybe they're wrong"],
      unknown: ["Lots of growth", "What does P/E mean?", "Not sure"],
      over: ["Buyers expect big growth", "Something unusual hit profit", "What does P/E mean?"],
      number: ["Lots of growth", "What does P/E mean?", "Maybe they're wrong"],
    };
    const owner =
      c.revenueTtm != null && c.netIncomeTtm != null
        ? `${c.name} took in ${usd(c.revenueTtm)} from customers over the last 12 months and ${c.netIncomeTtm > 0 ? `kept ${usd(c.netIncomeTtm)} of it as profit` : `still lost ${usd(-c.netIncomeTtm)}`}.`
        : c.revenueTtm != null
          ? `${c.name} took in ${usd(c.revenueTtm)} from customers over the last 12 months.`
          : `An owner asks how much of what customers pay the company gets to keep.`;
    const opener: Record<Intent, string> = {
      hype: `Agreed, ${theme} is a big deal. But everyone knows that. When good news is that well known, buyers have already paid up for it. Investors call that "priced in."`,
      customer: `Nice, you know it as a customer. Now look at it as an owner: ${owner} Lots of people know ${c.name}, though, so let's check what the price already assumes.`,
      momentum: `The chart shows what already happened. It can't tell us what happens next. Let's look at the business instead of the price.`,
      unsure: `That's fine, most investors start with a hunch. Let's test it.`,
      confused: `No problem, let's start simple.`,
      growth: `Growth is the right thing to look at.`,
      contrarian: `Ooh, a contrarian. Let's check.`,
      other: `Got it.`,
    };
    return {
      bubbles: [opener[classify(input ?? "")], tidy(pricedIn[kind])],
      chips: chips[kind],
      marks: [
        { slug: "revenue-vs-earnings", level: "encountered" },
        { slug: "pe-ratio", level: "encountered" },
        { slug: "already-priced-in", level: "encountered" },
      ],
    };
  }

  if (ctx.turn === 2) {
    const intent = classify(input ?? "");
    if (intent === "confused" || intent === "unsure") {
      if (kind === "loss") {
        return {
          bubbles: [concept("revenue-vs-earnings").kid_explanation, `So buyers are betting ${c.name} will start making a profit. Do you think that happens soon?`],
          chips: ["Yes, soon", "It'll take a while", "Maybe not"],
          marks: [{ slug: "revenue-vs-earnings", level: "explained" }],
        };
      }
      const stand = `P/E is the price divided by a year of profit. Picture a lemonade stand that makes $1,000 a year.${typical != null ? ` Paying $${typical},000 for it is like paying for a typical company.` : ""}`;
      const own =
        kind === "number"
          ? ` Paying $${peText},000 ${high ? "only makes sense if you think it'll make a lot more later" : level === "low" ? "means buyers expect it to grow slowly, or see more risk" : "means buyers expect it to grow about as fast as a typical company"}.`
          : kind === "over"
            ? ` Paying more than $100,000 only makes sense if you think it'll make a lot more later.`
            : ` The more you pay, the more profit has to grow for it to be worth it.`;
      return {
        bubbles: [stand + own, `Will ${c.name}'s profits grow faster than people already expect?`],
        chips: ["Yes, faster", "About what people expect", "Maybe slower"],
        marks: [{ slug: "pe-ratio", level: "explained" }],
      };
    }
    if (intent === "contrarian") {
      return {
        bubbles: [`Interesting. Lots of investors watch ${c.name} closely. What do you think they're missing?`],
        chips: ["A new product", "New customers", "They'll raise prices", "Not sure"],
      };
    }
    // Experienced players get the math behind "priced in": how long growth like
    // the last year's would take to bring the P/E down to a typical level.
    if (expert && kind === "number" && typical != null && c.pe! > typical && c.revenueGrowth != null && c.revenueGrowth > 0) {
      const g = Math.round(c.revenueGrowth);
      const pe5 = c.pe! / (1 + g / 100) ** 5;
      const stillHigh = pe5 > typical;
      return {
        bubbles: [
          `Let's check that. Say profit grows ${g}% a year for five years, like sales did over the last 12 months, and the stock price stays flat. The P/E would ${stillHigh ? "still be" : "fall to"} about ${pe5.toFixed(0)}, ${stillHigh ? "higher" : "lower"} than a typical company's ${typical} today.`,
          stillHigh
            ? `So the price is counting on growth even faster than that. What could make ${c.name} grow faster than ${g}% a year, or keep more of each sale as profit?`
            : `So the price is counting on about that much growth, year after year. What could make ${c.name} do better than that, and what could slow it down?`,
        ],
        chips: ["Sales grow faster", "Bigger profit margins", "A new product", "Not sure"],
        marks: [{ slug: "already-priced-in", level: "explained" }],
      };
    }
    const next: Record<PeCase, string> = {
      loss: `That's the bet. ${growth} It still isn't making a profit. What would have to change for it to make one?`,
      unknown: `Fair. ${growth} For the stock to beat the market from here, ${c.name} has to do better than buyers already expect. What could make that happen?`,
      over: `Either way, the price is counting on profit getting much bigger than it was this year. ${growth} What would have to happen for that to come true?`,
      number: high
        ? `Right. At ${peText} times profit, buyers already expect a lot of growth. ${growth} For the stock to beat the market from here, ${c.name} has to do even better than people expect. What could make that happen?`
        : level === "low"
          ? `At ${peText} times profit, buyers aren't expecting much growth. ${growth} What could surprise them?`
          : `At ${peText} times profit, buyers expect about what they expect from a typical company. ${growth} For the stock to beat the market from here, ${c.name} has to do better than that. What could make that happen?`,
    };
    return {
      bubbles: [tidy(next[kind])],
      chips: ["New customers", "Higher prices", "A new product", "Not sure"],
      marks: [{ slug: "already-priced-in", level: "explained" }],
    };
  }

  // Wrap up: name the weakest point, hand over to the thesis.
  const hole =
    kind === "loss"
      ? `it's losing money right now, so everything depends on that changing`
      : c.revenueGrowth != null && c.revenueGrowth < 0
        ? `sales are shrinking right now. What turns that around?`
        : kind === "over"
          ? `profit was tiny next to the price this year. Look at the last four quarters on its page: was it one bad quarter, or all four?`
          : kind === "number" && c.pe! > 40
            ? `if growth slows, buyers may not keep paying ${peText} times profit, and the stock can fall even if the business is doing fine`
            : `what could slow sales down? That's the question to keep asking`;
  return {
    bubbles: [
      `Good thinking. One thing worth watching: ${/[.?!]$/.test(hole) ? hole : hole + "."}`,
      `It's your call either way. Let's write your thesis: why you're buying, and one number you predict for the next earnings report.`,
    ],
    done: true,
    marks: [
      { slug: kind === "loss" ? "revenue-vs-earnings" : "pe-ratio", level: "explained" },
      { slug: "already-priced-in", level: "explained" },
    ],
  };
}

/** The point the coach said was worth watching, for the thesis screen's third prompt. */
export function worthWatching(log: ChatMsg[]): string | null {
  for (const m of log) {
    const hit = m.from === "coach" ? m.text.match(/worth watching: (.+)$/) : null;
    if (hit) return hit[1];
  }
  return null;
}

// ---------- a private company (SpaceX, OpenAI): find the public picks and shovels ----------

function privateScript(ctx: CoachContext, input: string | null): CoachReply {
  const f = ctx.facts ?? {};
  if (ctx.turn === 0) {
    return {
      bubbles: [`Here's an investor question for you, ${ctx.playerName}: ${f.question}`],
      chips: (f.chips ?? "").split("|").filter(Boolean),
    };
  }
  const unsure = classify(input ?? "") === "unsure";
  return {
    bubbles: [
      unsure
        ? `Fair! Hint: ${f.hint}`
        : `That's what investors call "picks and shovels." In a gold rush, the people selling shovels got paid no matter who found gold.`,
      `${f.answer} Tap any of them to look closer:`,
    ],
    tickers: (f.tickers ?? "").split(",").filter(Boolean),
    done: true,
  };
}

// The lines for each private company the curiosity screen knows
// (content/themes.yaml, not_in_game). Hand-written; who owns a stake in whom
// changes, so each fact needs a source check now and then (docs/data_needs.md).
export const PRIVATE_SCRIPTS: Record<string, Record<string, string>> = {
  SpaceX: {
    question: "if space really takes off, which public companies would do well?",
    chips: "Companies that build rockets|Satellite makers|Defense companies|No idea",
    hint: "someone has to build the engines, satellites and launch parts, and some of those companies are public.",
    answer: "These public companies build rockets, satellites and spacecraft parts.",
    tickers: "LMT,NOC,RTX,BA",
  },
  OpenAI: {
    question: "which public companies sell to AI labs, or own a piece of them?",
    chips: "Chip makers|Cloud companies|No idea",
    hint: "AI labs need huge numbers of chips and data centers, and they buy them from public companies.",
    answer: "These public companies sell chips and cloud computing to AI labs, and some invest in them.",
    tickers: "NVDA,MSFT,AMD,AVGO",
  },
  Anthropic: {
    question: "which public companies sell to AI labs, or own a piece of them?",
    chips: "Chip makers|Cloud companies|No idea",
    hint: "AI labs rent huge data centers full of chips, and some big public companies have invested in them.",
    answer: "These public companies sell chips and cloud computing to AI labs. Amazon and Google have also invested in Anthropic, so they own a piece of it.",
    tickers: "AMZN,GOOGL,NVDA,AVGO",
  },
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
