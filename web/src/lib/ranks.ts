// Ranks and lesson unlocking, computed from progress records, never stored.
// Rules from docs/concept.md: ranks need every concept of a level *applied*
// (used in a thesis); Level 3 lessons open one at a time, once the concepts
// they build on have been applied. Ported from the prototype; the input is the
// player's progress rather than the prototype's whole game state.
import { concept, concepts, lessonFor, type Concept } from "@/content";

export type ProgressLevel = "encountered" | "explained" | "applied";
export type Progress = Partial<Record<ProgressLevel, number>> & { evidence?: string[] };

export type RankInput = {
  hasPick: boolean; // a first pick with a written thesis makes a Shareholder
  progress: Record<string, Progress>; // by concept slug
  lessonsDone: string[]; // concept slugs
  unlockAll?: boolean; // test and demo shortcut: open every lesson
};

export const RANKS = [
  { name: "Shareholder", icon: "📜", level: 0, rule: "Make a first pick with a written thesis" },
  { name: "Owner", icon: "🔑", level: 1, rule: "Use every Level 1 concept in a thesis" },
  { name: "Board Member", icon: "🪑", level: 2, rule: "Use every Level 2 concept in a thesis" },
  { name: "Chair", icon: "🏛️", level: 3, rule: "Use every Level 3 concept, plus a full season of predictions" },
];

export const ofLevel = (lvl: number) => concepts.filter((c) => c.level === lvl);
export const appliedIn = (s: RankInput, lvl: number) => ofLevel(lvl).filter((c) => s.progress[c.slug]?.applied);

export function rankIndex(s: RankInput): number {
  let i = s.hasPick ? 0 : -1;
  if (i === 0 && appliedIn(s, 1).length === ofLevel(1).length) i = 1;
  if (i === 1 && appliedIn(s, 2).length === ofLevel(2).length) i = 2;
  return i;
}

// Level 1 and 2 are always open. A Level 3 concept opens once its
// prerequisites are used in a thesis; before that, players can only peek.
export function missingPrereqs(s: RankInput, c: Concept): Concept[] {
  if (c.level < 3 || s.unlockAll) return [];
  return c.prerequisites.map(concept).filter((p) => !s.progress[p.slug]?.applied);
}

export const isOpen = (s: RankInput, c: Concept) => missingPrereqs(s, c).length === 0;

// The next concept on the player's rank path that they haven't used yet.
export function nextToApply(s: RankInput): Concept | undefined {
  const lvl = Math.max(1, Math.min(3, rankIndex(s) + 1));
  return ofLevel(lvl).find((c) => !s.progress[c.slug]?.applied);
}

// One lesson to suggest: a concept the player has seen but not learned (seen
// most often first), else the next lesson on their rank path.
export function upNext(s: RankInput): Concept | undefined {
  const withLesson = concepts.filter((c) => lessonFor(c.slug) && isOpen(s, c) && !s.lessonsDone.includes(c.slug));
  const seen = withLesson
    .filter((c) => s.progress[c.slug]?.encountered)
    .sort((a, b) => (s.progress[b.slug]?.evidence?.length ?? 0) - (s.progress[a.slug]?.evidence?.length ?? 0));
  return seen[0] ?? withLesson.sort((a, b) => a.level - b.level)[0];
}
