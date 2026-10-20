// The coach. Today it's a script with a few branches; later the body of
// askCoach() becomes one call to the Claude API with the same inputs (the
// moment, the company's numbers, the relevant concept records and the
// player's progress) and the same output shape. Nothing else should change.
//
// Product rule: the coach asks questions and shows numbers. It never says a
// stock is good or bad, never tells a player what to buy, never blocks a trade.
//
// Voice: written for a smart 14-year-old with no investing background. Every
// term is explained the first time it's used, and every number comes with
// something to compare it to.
import { MARKET_PE, concept, fill, lens, lessonFor, sectorPlural } from '../content'
import { marketCapB, peRatio, type Company } from '../data/companies'
import { bigUsd } from '../lib/format'
import type { ChatMsg, ProgressLevel } from '../state/store'

export type CoachMode = 'pick' | 'private' | 'sell' | 'debrief' | 'explain' | 'lesson'

export type CoachContext = {
  mode: CoachMode
  playerName: string
  company?: Company
  history: ChatMsg[]
  turn: number // how many replies the coach has already given
  facts?: Record<string, string> // precomputed numbers for the moment, e.g. sell-now cost
}

export type CoachReply = {
  bubbles: string[]
  chips?: string[]
  tickers?: string[] // companies to show as tappable cards
  done?: boolean
  marks?: { slug: string; level: ProgressLevel }[]
}

export async function askCoach(ctx: CoachContext, input: string | null): Promise<CoachReply> {
  await new Promise((r) => setTimeout(r, 650 + Math.random() * 500)) // feels like typing
  switch (ctx.mode) {
    case 'pick': return pickScript(ctx, input)
    case 'private': return privateScript(ctx, input)
    case 'sell': return sellScript(ctx, input)
    case 'debrief': return debriefScript(ctx, input)
    case 'explain': return explainScript(ctx, input)
    case 'lesson': return lessonScript(ctx, input)
  }
}

// ---------- scripted branches ----------

type Intent = 'hype' | 'customer' | 'momentum' | 'unsure' | 'confused' | 'growth' | 'contrarian' | 'other'

function classify(text: string): Intent {
  const t = text.toLowerCase()
  if (/what does|what's that|whats that|what is|what's a|confus|don'?t get|huh|mean\?/.test(t)) return 'confused'
  if (/not sure|idk|dunno|no idea|\?$/.test(t)) return 'unsure'
  if (/nothing|underrat|missing|people don'?t|nobody|no one|wrong/.test(t)) return 'contrarian'
  if (/growth|grow|more sales|expand|bigger/.test(t)) return 'growth'
  if (/going up|went up|keeps? (going|rising)|stock is up|price is up|moon|rocket/.test(t)) return 'momentum'
  if (/\buse\b|love|buy|play|watch|eat|drink|wear|my phone|i have|we have|everyone has|shop/.test(t)) return 'customer'
  if (/huge|ai\b|everyone|famous|popular|best|big|future|hype/.test(t)) return 'hype'
  return 'other'
}

function pickScript(ctx: CoachContext, input: string | null): CoachReply {
  const c = ctx.company!
  const pe = peRatio(c)
  const peText = pe === null ? '' : pe.toFixed(0)
  const theme = c.ai ? 'AI' : c.name
  const range = lens(c.lens)?.typical_pe
  const sector = sectorPlural(c.lens)
  const compare =
    pe === null ? ''
      : `A typical S&P 500 company is about ${MARKET_PE}${range ? `, and ${sector} are usually ${range[0]} to ${range[1]}` : ''}.`

  if (ctx.turn === 0) {
    return {
      bubbles: [
        `Hey ${ctx.playerName}! I'm your coach. I won't tell you what to buy. I ask questions so your pick has a real reason behind it.`,
        `So: why ${c.name}? What got you interested?`,
      ],
      chips: [c.ai ? 'AI is huge' : `Everyone knows ${c.name}`, 'I use their stuff', 'The stock keeps going up', 'Not sure yet'],
      marks: [{ slug: 'market-cap-vs-share-price', level: 'encountered' }],
    }
  }

  // The signature move: what does the price already assume? (Or why P/E doesn't apply.)
  const pricedIn =
    pe === null
      ? `${c.name} lost ${bigUsd(-c.earningsB)} last year, so it has no P/E: there's no profit to divide by. Buyers still pay ${bigUsd(marketCapB(c))} for the whole company. What are they expecting to happen?`
      : `Here's one way to see it. ${c.name}'s stock costs about ${peText} times what the company earned last year. That number is called the P/E. ${compare} So what are buyers expecting that makes them pay ${pe > MARKET_PE ? 'that much' : 'that'}?`
  const pricedInChips =
    pe === null ? ['It makes money again', 'What does that mean?', "Maybe they're wrong"]
      : ['Lots of growth', 'What does P/E mean?', "Maybe they're wrong"]

  if (ctx.turn === 1) {
    const intent = classify(input ?? '')
    const opener: Record<Intent, string> = {
      hype: `Agreed, ${theme} is a big deal. But everyone knows that. When good news is that well known, buyers have already paid up for it. Investors call that "priced in."`,
      customer: `Nice, you know it as a customer. Now look at it as an owner: ${c.name} took in ${bigUsd(c.revenueB)} from customers last year and ${c.earningsB > 0 ? `kept ${bigUsd(c.earningsB)} of it as profit` : `still lost ${bigUsd(-c.earningsB)}`}. Lots of people know ${c.name}, though, so let's check what the price already assumes.`,
      momentum: `The chart shows what already happened. It can't tell us what happens next. Let's look at the business instead of the price.`,
      unsure: `That's fine, most investors start with a hunch. Let's test it.`,
      confused: `No problem, let's start simple.`,
      growth: `Growth is the right thing to look at.`,
      contrarian: `Ooh, a contrarian. Let's check.`,
      other: `Got it.`,
    }
    return {
      bubbles: [opener[intent], pricedIn],
      chips: pricedInChips,
      marks: [
        { slug: 'revenue-vs-earnings', level: 'encountered' },
        { slug: 'pe-ratio', level: 'encountered' },
        { slug: 'already-priced-in', level: 'encountered' },
      ],
    }
  }

  if (ctx.turn === 2) {
    const intent = classify(input ?? '')
    if (intent === 'confused' || intent === 'unsure') {
      return {
        bubbles: pe === null
          ? [
              concept('revenue-vs-earnings').kid_explanation,
              `So buyers are betting ${c.name} will start making a profit. Do you think that happens soon?`,
            ]
          : [
              `P/E is the price divided by a year of profit. Picture a lemonade stand that makes $1,000 a year. Paying $${MARKET_PE},000 for it is like paying for a typical company. Paying $${peText},000 only makes sense if you think it'll make a lot more later.`,
              `Will ${c.name}'s profits grow faster than people already expect?`,
            ],
        chips: ['Yes, faster', 'About what people expect', 'Maybe slower'],
        marks: [{ slug: pe === null ? 'revenue-vs-earnings' : 'pe-ratio', level: 'explained' }],
      }
    }
    if (intent === 'contrarian') {
      return {
        bubbles: [`Interesting. Lots of investors watch ${c.name} closely. What do you think they're missing?`],
        chips: ['A new product', 'New customers', "They'll raise prices", 'Not sure'],
      }
    }
    return {
      bubbles: [
        pe === null
          ? `That's the bet. Revenue (all the money from customers) grew ${c.revenueGrowth}% last year, but costs grew more. What would have to change for it to make a profit?`
          : pe > MARKET_PE
            ? `Right. At ${peText} times profit, buyers already expect a lot of growth. Revenue grew ${c.revenueGrowth}% last year. For the stock to beat the market from here, ${c.name} has to do even better than people expect. What could make that happen?`
            : `At ${peText} times profit, buyers aren't expecting much growth. Revenue grew ${c.revenueGrowth}% last year. What could surprise them?`,
      ],
      chips: ['New customers', 'Higher prices', 'A new product', 'Not sure'],
      marks: [{ slug: 'already-priced-in', level: 'explained' }],
    }
  }

  // Wrap up: name the weakest point, hand over to the thesis.
  const hole =
    pe === null ? `it's losing money right now, so everything depends on that changing`
      : c.revenueGrowth < 0 ? `sales are shrinking right now. What turns that around?`
      : pe > 40 ? `if growth slows, buyers may not keep paying ${peText} times profit, and the stock can fall even if the business is doing fine`
      : `what could slow sales down? That's the question to keep asking`
  return {
    bubbles: [
      `Good thinking. One thing worth watching: ${hole}.`,
      `It's your call either way. Let's write your thesis: why you're buying, and one number you predict for the next earnings report.`,
    ],
    done: true,
    marks: [
      { slug: pe === null ? 'revenue-vs-earnings' : 'pe-ratio', level: 'explained' },
      { slug: 'already-priced-in', level: 'explained' },
    ],
  }
}

// A private company (SpaceX, OpenAI): find the public picks and shovels.
function privateScript(ctx: CoachContext, input: string | null): CoachReply {
  const f = ctx.facts ?? {}
  if (ctx.turn === 0) {
    return {
      bubbles: [`Here's an investor question for you, ${ctx.playerName}: ${f.question}`],
      chips: (f.chips ?? '').split('|'),
    }
  }
  const unsure = classify(input ?? '') === 'unsure'
  return {
    bubbles: [
      unsure
        ? `Fair! Hint: ${f.hint}`
        : `That's what investors call "picks and shovels." In a gold rush, the people selling shovels got paid no matter who found gold.`,
      `${f.answer} Tap any of them to look closer:`,
    ],
    tickers: (f.tickers ?? '').split(','),
    done: true,
  }
}

function sellScript(ctx: CoachContext, input: string | null): CoachReply {
  const f = ctx.facts ?? {}
  if (ctx.turn === 0) {
    return {
      bubbles: [`Quick check before you sell. Selling today costs ${f.extraTax} more in tax than waiting ${f.daysToWait} days. What's your reason to sell today?`],
      chips: ["I think it'll drop", 'I want the money for another pick', 'Lock in the gain'],
      marks: [{ slug: 'costs-and-taxes', level: 'encountered' }],
    }
  }
  const t = (input ?? '').toLowerCase()
  const reply = /drop|fall|down/.test(t)
    ? `That's a real reason. If it drops more than ${f.extraTax} in the next ${f.daysToWait} days, selling now comes out ahead. If not, waiting does.`
    : /pick|another|money/.test(t)
      ? `Makes sense. Just count the ${f.extraTax} as part of the cost of the new pick.`
      : `Locking in feels good. The price of that feeling is ${f.extraTax} in extra tax.`
  return { bubbles: [reply, `Your call. I'll never stop a trade.`], done: true, marks: [{ slug: 'costs-and-taxes', level: 'explained' }] }
}

// Office hours on one concept, opened from a tapped term. The real coach will
// answer anything; the script covers the two most useful follow-ups.
function explainScript(ctx: CoachContext, input: string | null): CoachReply {
  const c = concept(ctx.facts?.slug ?? '')
  const chips = ['How would I use it in a thesis?', "What's a common mistake?"]
  if (ctx.turn === 0) {
    return { bubbles: [`What do you want to know about ${c.name.toLowerCase()}?`], chips }
  }
  const t = (input ?? '').toLowerCase()
  const answer = /thesis|use/.test(t) && c.in_a_thesis
    ? `Something like this: "${c.in_a_thesis}" Using it in your own thesis is what counts for your rank.`
    : /mistake|wrong|trap/.test(t) && c.misconceptions[0]
      ? `A lot of people think: "${c.misconceptions[0]}" That's the trap. ${c.kid_explanation}`
      : `Good question. In the real game I'll answer anything here. In this prototype I only know a couple of answers, so try one of these.`
  return { bubbles: [answer], chips, done: ctx.turn >= 3 }
}

// Round 3 of a lesson ("Your turn"): ask, push back once, wrap up. The script
// comes from content/lessons.yaml; facts fill its {placeholders}.
function lessonScript(ctx: CoachContext, input: string | null): CoachReply {
  const f = ctx.facts ?? {}
  const l = lessonFor(f.slug ?? '')!.your_turn
  if (ctx.turn === 0) {
    return { bubbles: l.ask.map((b) => fill(b, f)), chips: l.chips.map((c) => fill(c, f)) }
  }
  if (ctx.turn === 1) {
    const t = input ?? ''
    const p = l.pushback.find((x) => x.match && new RegExp(x.match, 'i').test(t)) ?? l.pushback.find((x) => !x.match)!
    return { bubbles: [fill(p.say, f)], chips: p.chips?.map((c) => fill(c, f)) }
  }
  return { bubbles: [fill(l.wrap, f)], done: true }
}

// After a time machine replay. The replay computes its own numbers and the
// coach's lines from them (src/data/time_machine.ts), passed in as facts:
// reply0, reply1… (bubbles split on "|"), questions, and concepts to mark.
function debriefScript(ctx: CoachContext, input: string | null): CoachReply {
  const f = ctx.facts ?? {}
  void input
  const lastTurn = ctx.turn >= Number(f.questions ?? 1) - 1
  return {
    bubbles: (f[`reply${ctx.turn}`] ?? '').split('|').filter(Boolean),
    done: lastTurn,
    marks: lastTurn ? (f.concepts ?? '').split(',').filter(Boolean).map((slug) => ({ slug, level: 'explained' as const })) : [],
  }
}
