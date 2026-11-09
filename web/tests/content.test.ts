import { describe, expect, it } from "vitest";
import { concept, concepts, glossary, lenses, lessons, scenarios, themes } from "@/content";

// The content catalogs are hand-edited YAML; these checks catch a broken link
// between them before it reaches a screen.
describe("content catalogs", () => {
  const slugs = new Set(concepts.map((c) => c.slug));

  it("load", () => {
    expect(concepts.length).toBeGreaterThan(10);
    expect(lessons.length).toBeGreaterThan(0);
    expect(scenarios.length).toBeGreaterThan(0);
    expect(lenses.length).toBeGreaterThan(0);
    expect(themes.length).toBeGreaterThan(0);
    expect(glossary.length).toBeGreaterThan(0);
  });

  it("concept slugs are unique and levels are 1 to 3", () => {
    expect(slugs.size).toBe(concepts.length);
    for (const c of concepts) expect([1, 2, 3]).toContain(c.level);
  });

  it("every prerequisite is a concept", () => {
    for (const c of concepts) for (const p of c.prerequisites) expect(slugs.has(p), `${c.slug} → ${p}`).toBe(true);
  });

  it("every lesson, scenario and lens points at known concepts", () => {
    for (const l of lessons) expect(slugs.has(l.concept), l.concept).toBe(true);
    for (const s of scenarios) for (const c of s.concepts) expect(slugs.has(c), `${s.slug} → ${c}`).toBe(true);
    for (const l of lenses) for (const c of l.concepts) expect(slugs.has(c), `${l.kind} → ${c}`).toBe(true);
  });

  it("whitespace in prose is tidied", () => {
    for (const c of concepts) expect(c.kid_explanation).not.toMatch(/\s{2,}|\n/);
  });

  it("concept() throws on an unknown slug", () => {
    expect(() => concept("not-a-concept")).toThrow(/Unknown concept/);
  });
});
