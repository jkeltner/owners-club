// Ranks and lesson unlocking, computed from progress records, never stored.
// Rules from docs/concept.md: ranks need every concept of a level *applied*
// (used in a thesis); Level 3 lessons open one at a time, once the concepts
// they build on have been applied.
import { concept, concepts, lessonFor, type Concept } from '../content'
import type { GameState } from '../state/store'

export const RANKS = [
  { name: 'Shareholder', icon: '📜', level: 0, rule: 'Make a first pick with a written thesis' },
  { name: 'Owner', icon: '🔑', level: 1, rule: 'Use every Level 1 concept in a thesis' },
  { name: 'Board Member', icon: '🪑', level: 2, rule: 'Use every Level 2 concept in a thesis' },
  { name: 'Chair', icon: '🏛️', level: 3, rule: 'Use every Level 3 concept, plus a full season of predictions' },
]

export const ofLevel = (lvl: number) => concepts.filter((c) => c.level === lvl)
export const appliedIn = (s: GameState, lvl: number) => ofLevel(lvl).filter((c) => s.concepts[c.slug]?.applied)

export function rankIndex(s: GameState): number {
  let i = s.pick ? 0 : -1
  if (i === 0 && appliedIn(s, 1).length === ofLevel(1).length) i = 1
  if (i === 1 && appliedIn(s, 2).length === ofLevel(2).length) i = 2
  return i
}

// Level 1 and 2 are always open. A Level 3 concept opens once its
// prerequisites are used in a thesis; before that, players can only peek.
export function missingPrereqs(s: GameState, c: Concept): Concept[] {
  if (c.level < 3 || s.unlockAll) return []
  return c.prerequisites.map(concept).filter((p) => !s.concepts[p.slug]?.applied)
}

export const isOpen = (s: GameState, c: Concept) => missingPrereqs(s, c).length === 0

// The next concept on the player's rank path that they haven't used yet.
export function nextToApply(s: GameState): Concept | undefined {
  const lvl = Math.max(1, Math.min(3, rankIndex(s) + 1))
  return ofLevel(lvl).find((c) => !s.concepts[c.slug]?.applied)
}

// One lesson to suggest: a concept the player has seen but not learned (seen
// most often first), else the next lesson on their rank path.
export function upNext(s: GameState): Concept | undefined {
  const withLesson = concepts.filter((c) => lessonFor(c.slug) && isOpen(s, c) && !s.lessonsDone.includes(c.slug))
  const seen = withLesson
    .filter((c) => s.concepts[c.slug]?.encountered)
    .sort((a, b) => (s.concepts[b.slug]?.evidence?.length ?? 0) - (s.concepts[a.slug]?.evidence?.length ?? 0))
  return seen[0] ?? withLesson.sort((a, b) => a.level - b.level)[0]
}
