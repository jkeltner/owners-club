// Stand-in for the concept tagger: after a thesis is written, mark the
// concepts it *uses* as applied. The real one is a small model call.
// Rule: only a thesis or scouting report can mark a concept "applied".

const RULES: { slug: string; pattern: RegExp }[] = [
  { slug: 'pe-ratio', pattern: /\bp\/?e\b|times (its )?(earnings|profit)|price.to.earnings|per dollar of (earnings|profit)/i },
  { slug: 'already-priced-in', pattern: /priced in|in the price|already expect|people expect|than (people|investors|everyone) (think|expect)|missing/i },
  { slug: 'revenue-vs-earnings', pattern: /\b(revenue|sales)\b.*\b(profit|earnings)\b|\b(profit|earnings)\b.*\b(revenue|sales)\b|\bmargin/i },
  { slug: 'market-cap-vs-share-price', pattern: /market cap|whole company|worth \$?\d/i },
  { slug: 'index-as-benchmark', pattern: /s&p|\bindex\b|beat the market|the market/i },
]

export function tagThesis(text: string): string[] {
  return RULES.filter((r) => r.pattern.test(text)).map((r) => r.slug)
}
