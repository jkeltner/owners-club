// The words the game explains wherever they appear. Each pattern points at a
// concept (content/concepts.yaml) or a glossary term (content/glossary.yaml).
// Order matters: longer and more specific phrases first. Ported from the
// prototype (prototype/src/components/terms.tsx).
export type TermKey = { kind: "concept" | "glossary"; slug: string };

export const PATTERNS: [RegExp, TermKey][] = [
  [/\bgross margin\b/i, { kind: "glossary", slug: "gross-margin" }],
  [/\boperating margin\b/i, { kind: "glossary", slug: "operating-margin" }],
  [/\bearnings per share\b|\bEPS\b/, { kind: "glossary", slug: "eps" }],
  [/\bearnings reports?\b|\breports earnings\b/i, { kind: "glossary", slug: "earnings-report" }],
  [/\bsame-store sales\b/i, { kind: "glossary", slug: "same-store-sales" }],
  [/\b(order )?backlog\b/i, { kind: "glossary", slug: "backlog" }],
  [/\borganic sales growth\b/i, { kind: "glossary", slug: "organic-growth" }],
  [/\bcustomer retention\b/i, { kind: "glossary", slug: "customer-retention" }],
  [/\bsubscriber growth and churn\b|\bchurn\b/i, { kind: "glossary", slug: "subscribers-churn" }],
  [/\bcash conversion\b/i, { kind: "glossary", slug: "cash-conversion" }],
  [/\binventory\b/i, { kind: "glossary", slug: "inventory" }],
  [/\bclosing price\b|\btoday's close\b|\byesterday's close\b|\bthe next close\b/i, { kind: "glossary", slug: "closing-price" }],
  [/\bindex fund\b/i, { kind: "glossary", slug: "index-fund" }],
  [/\bdividend yield\b|\bdividends?\b/i, { kind: "concept", slug: "dividends" }],
  [/\bscouting reports?\b/i, { kind: "glossary", slug: "scouting-report" }],
  [/\bthes[ie]s\b/i, { kind: "glossary", slug: "thesis" }],
  [/\bthe Dow\b|\bDow Jones\b/, { kind: "glossary", slug: "dow" }],
  [/\bNasdaq\b/, { kind: "glossary", slug: "nasdaq" }],
  [/\bPEG( ratio)?\b/, { kind: "concept", slug: "peg-ratio" }],
  [/\bP\/E( ratio)?/, { kind: "concept", slug: "pe-ratio" }],
  [/\bmarket cap\b/i, { kind: "concept", slug: "market-cap-vs-share-price" }],
  [/\bfree[- ]cash[- ]flow\b|\bfree cash\b/i, { kind: "concept", slug: "free-cash-flow" }],
  [/\bRule of 40\b/i, { kind: "concept", slug: "rule-of-40" }],
  [/\bpriced in\b|\balready in the price\b/i, { kind: "concept", slug: "already-priced-in" }],
  [/\breturn on invested capital\b|\bROIC\b|\breturn on equity\b/i, { kind: "concept", slug: "return-on-equity-roic" }],
  [/\bpeak of a boom\b|\bboom-and-bust\b|\bbooms and busts\b/i, { kind: "concept", slug: "peak-cycle-earnings" }],
  [/\bprofit margins?\b|\bmargins\b/i, { kind: "concept", slug: "profit-margins" }],
  [/\brevenue\b/i, { kind: "concept", slug: "revenue-vs-earnings" }],
  [/\bearnings\b/i, { kind: "concept", slug: "revenue-vs-earnings" }],
];

// What a tapped term shows: the plain explanation, what's normal and an example.
export type TermCard = { title: string; body: string; normal?: string; example?: string };
export type TermBook = Record<string, TermCard>; // by "concept:slug" or "glossary:slug"
export const termId = (k: TermKey) => `${k.kind}:${k.slug}`;
