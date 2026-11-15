// Builds the small book of explanations the tappable terms open, from the
// shared content catalogs. Runs on the server; only the terms the patterns can
// find are sent to the browser, not the whole catalog.
import { concepts, glossary } from "@/content";
import { PATTERNS, termId, type TermBook } from "./term_patterns";

export function termBook(): TermBook {
  const book: TermBook = {};
  for (const [, key] of PATTERNS) {
    const id = termId(key);
    if (book[id]) continue;
    if (key.kind === "concept") {
      const c = concepts.find((x) => x.slug === key.slug);
      if (c) book[id] = { title: c.name, body: c.kid_explanation, normal: c.whats_normal, example: c.example };
    } else {
      const t = glossary.find((x) => x.slug === key.slug);
      if (t) book[id] = { title: t.term, body: t.explanation, example: t.example };
    }
  }
  return book;
}
