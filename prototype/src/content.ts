// Loads the shared content catalogs from /content at build time, so the
// prototype always shows the same concept names, kid explanations, lenses and
// themes the real app will use.
import { parse } from 'yaml'
import conceptsRaw from '../../content/concepts.yaml?raw'
import lensesRaw from '../../content/sector_lenses.yaml?raw'
import themesRaw from '../../content/themes.yaml?raw'
import scenariosRaw from '../../content/scenarios.yaml?raw'
import glossaryRaw from '../../content/glossary.yaml?raw'
import lessonsRaw from '../../content/lessons.yaml?raw'

export type CheckQuestion = { question: string; choices: string[]; answer: string; why: string }

export type Concept = {
  slug: string
  name: string
  level: 1 | 2 | 3
  prerequisites: string[]
  learned_by: 'explanation' | 'experience'
  kid_explanation: string
  example?: string
  whats_normal?: string
  in_a_thesis?: string
  misconceptions: string[]
  coach_questions: string[]
  check_questions: CheckQuestion[]
  status: 'draft' | 'active'
}

export type Lens = {
  kind: string
  look_first: string
  then: string[]
  careful_with: string
  concepts: string[]
  typical_pe?: [number, number]
}

export type Theme = { name: string; blurb: string; tickers: string[] }
export type NotInGame = { name: string; theme?: string; reason: string; lesson: string }
export type GlossaryTerm = { slug: string; term: string; explanation: string; example?: string }

export type LessonFormat = 'talk' | 'time_machine' | 'sort' | 'what_if' | 'simulate' | 'flaw'
export type LessonChoice = { text: string; say: string; right?: boolean }
export type Pushback = { match?: string; say: string; chips?: string[] }
export type Lesson = {
  concept: string
  format: LessonFormat
  minutes: number
  see_it: { setup: string; question: string; choices: LessonChoice[] }
  try_it: { intro: string }
  your_turn: { ask: string[]; chips: string[]; pushback: Pushback[]; wrap: string }
}

export type Scenario = {
  slug: string
  concepts: string[]
  blind_description: string
  checkpoints: string[]
  reveal: string
  debrief_questions: string[]
}

const conceptsDoc = parse(conceptsRaw) as { concepts: Concept[]; rank_thresholds: Record<string, string> }
const lensesDoc = parse(lensesRaw) as { lenses: Lens[] }
const themesDoc = parse(themesRaw) as { themes: Theme[]; not_in_game: NotInGame[] }
const scenariosDoc = parse(scenariosRaw) as { scenarios: Scenario[] }
const glossaryDoc = parse(glossaryRaw) as { terms: GlossaryTerm[] }
const lessonsDoc = parse(lessonsRaw) as { lessons: Lesson[] }

const tidy = (s: string) => s.replace(/\s+/g, ' ').trim()

export const concepts: Concept[] = conceptsDoc.concepts.map((c) => ({
  ...c,
  kid_explanation: tidy(c.kid_explanation),
  example: c.example && tidy(c.example),
  whats_normal: c.whats_normal && tidy(c.whats_normal),
  in_a_thesis: c.in_a_thesis && tidy(c.in_a_thesis),
  misconceptions: c.misconceptions ?? [],
  coach_questions: c.coach_questions ?? [],
  check_questions: c.check_questions ?? [],
}))
export const rankThresholds = conceptsDoc.rank_thresholds
export const lenses = lensesDoc.lenses
export const themes = themesDoc.themes.map((t) => ({ ...t, blurb: tidy(t.blurb) }))
export const notInGame = themesDoc.not_in_game
export const scenarios = scenariosDoc.scenarios.map((s) => ({
  ...s,
  blind_description: tidy(s.blind_description),
}))

export const glossary = glossaryDoc.terms.map((t) => ({
  ...t,
  explanation: tidy(t.explanation),
  example: t.example && tidy(t.example),
}))
export const glossaryTerm = (slug: string) => glossary.find((t) => t.slug === slug)

export const lessons: Lesson[] = lessonsDoc.lessons.map((l) => ({
  ...l,
  see_it: {
    setup: tidy(l.see_it.setup),
    question: tidy(l.see_it.question),
    choices: l.see_it.choices.map((c) => ({ ...c, text: String(c.text), say: tidy(c.say) })),
  },
  try_it: { intro: tidy(l.try_it.intro) },
  your_turn: {
    ...l.your_turn,
    ask: l.your_turn.ask.map(tidy),
    chips: l.your_turn.chips.map(String),
    pushback: l.your_turn.pushback.map((p) => ({ ...p, say: tidy(p.say), chips: p.chips?.map(String) })),
    wrap: tidy(l.your_turn.wrap),
  },
}))
export const lessonFor = (slug: string) => lessons.find((l) => l.concept === slug)

// Fills {placeholders} in lesson text from the game's numbers.
export const fill = (text: string, facts: Record<string, string> = {}) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => facts[k] ?? m)

// The market-wide yardstick every P/E is compared against.
export const MARKET_PE = 23

export function concept(slug: string): Concept {
  const c = concepts.find((x) => x.slug === slug)
  if (!c) throw new Error(`Unknown concept: ${slug}`)
  return c
}

// "Software" -> "software companies", "Chipmakers" -> "chipmakers"
export const sectorPlural = (kind: string) => (kind.endsWith('s') ? kind.toLowerCase() : `${kind.toLowerCase()} companies`)

export function lens(kind: string): Lens | undefined {
  return lenses.find((l) => l.kind === kind)
}
