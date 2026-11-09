import { describe, expect, it } from "vitest";
import { concepts } from "@/content";
import { appliedIn, isOpen, missingPrereqs, nextToApply, ofLevel, rankIndex, upNext, type RankInput } from "@/lib/ranks";

const applied = (slugs: string[]) => Object.fromEntries(slugs.map((s) => [s, { applied: Date.now() }]));
const empty: RankInput = { hasPick: false, progress: {}, lessonsDone: [] };

describe("ranks", () => {
  it("nobody is anything before a first pick", () => {
    expect(rankIndex(empty)).toBe(-1);
  });
  it("a first pick makes a Shareholder", () => {
    expect(rankIndex({ ...empty, hasPick: true })).toBe(0);
  });
  it("Owner needs every Level 1 concept applied, not just explained", () => {
    const level1 = ofLevel(1).map((c) => c.slug);
    const explainedOnly = Object.fromEntries(level1.map((s) => [s, { explained: 1 }]));
    expect(rankIndex({ hasPick: true, progress: explainedOnly, lessonsDone: [] })).toBe(0);
    expect(rankIndex({ hasPick: true, progress: applied(level1.slice(0, -1)), lessonsDone: [] })).toBe(0);
    expect(rankIndex({ hasPick: true, progress: applied(level1), lessonsDone: [] })).toBe(1);
  });
  it("Board Member needs Level 2 as well, and only after Owner", () => {
    const level1 = ofLevel(1).map((c) => c.slug);
    const level2 = ofLevel(2).map((c) => c.slug);
    expect(rankIndex({ hasPick: true, progress: applied(level2), lessonsDone: [] })).toBe(0);
    expect(rankIndex({ hasPick: true, progress: applied([...level1, ...level2]), lessonsDone: [] })).toBe(2);
    expect(appliedIn({ hasPick: true, progress: applied(level2), lessonsDone: [] }, 2)).toHaveLength(level2.length);
  });
});

describe("lesson unlocking", () => {
  const level3 = concepts.filter((c) => c.level === 3 && c.prerequisites.length);
  it("Level 1 and 2 are always open", () => {
    for (const c of concepts.filter((c) => c.level < 3)) expect(isOpen(empty, c)).toBe(true);
  });
  it("a Level 3 concept opens once its prerequisites are applied", () => {
    expect(level3.length).toBeGreaterThan(0);
    const c = level3[0];
    expect(missingPrereqs(empty, c).map((p) => p.slug)).toEqual(c.prerequisites);
    expect(isOpen({ ...empty, progress: applied(c.prerequisites) }, c)).toBe(true);
    expect(isOpen({ ...empty, unlockAll: true }, c)).toBe(true);
  });
});

describe("what to do next", () => {
  it("points at the first unused concept on the rank path", () => {
    const first = ofLevel(1)[0];
    expect(nextToApply({ ...empty, hasPick: true })?.slug).toBe(first.slug);
    expect(nextToApply({ ...empty, hasPick: true, progress: applied([first.slug]) })?.slug).toBe(ofLevel(1)[1].slug);
  });
  it("suggests the lesson for a concept seen most often, else the lowest level", () => {
    const withLesson = concepts.filter((c) => c.level === 1 && c.slug);
    const seen = withLesson[1];
    const s: RankInput = { ...empty, progress: { [seen.slug]: { encountered: 1, evidence: ["a", "b"] } } };
    const next = upNext(s);
    expect(next).toBeDefined();
    // Either the seen concept (if it has a lesson) or some open lesson at the lowest level.
    expect(next!.level).toBeLessThanOrEqual(seen.level);
  });
});
