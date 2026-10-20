// Tappable terms. <Linked text="..."/> finds known terms in any sentence (coach
// bubbles, the sector lens, recaps) and makes the first mention of each one
// open a sheet: the plain explanation, what's normal, an example, a check
// question and a way to ask the coach.
import { useState, type ReactNode } from 'react'
import { CoachChat } from './coach_chat'
import { concept, glossaryTerm, lessonFor, type Concept } from '../content'
import { isOpen } from '../lib/ranks'
import { useGame } from '../state/store'
import { Button, Sheet } from './ui'

type Key = { kind: 'concept' | 'glossary'; slug: string }

// Order matters: longer and more specific phrases first.
const PATTERNS: [RegExp, Key][] = [
  [/\bgross margin\b/i, { kind: 'glossary', slug: 'gross-margin' }],
  [/\boperating margin\b/i, { kind: 'glossary', slug: 'operating-margin' }],
  [/\bearnings per share\b|\bEPS\b/, { kind: 'glossary', slug: 'eps' }],
  [/\bearnings reports?\b|\breports earnings\b/i, { kind: 'glossary', slug: 'earnings-report' }],
  [/\bsame-store sales\b/i, { kind: 'glossary', slug: 'same-store-sales' }],
  [/\b(order )?backlog\b/i, { kind: 'glossary', slug: 'backlog' }],
  [/\borganic sales growth\b/i, { kind: 'glossary', slug: 'organic-growth' }],
  [/\bcustomer retention\b/i, { kind: 'glossary', slug: 'customer-retention' }],
  [/\bsubscriber growth and churn\b|\bchurn\b/i, { kind: 'glossary', slug: 'subscribers-churn' }],
  [/\bcash conversion\b/i, { kind: 'glossary', slug: 'cash-conversion' }],
  [/\binventory\b/i, { kind: 'glossary', slug: 'inventory' }],
  [/\bclosing price\b|\btoday's close\b|\byesterday's close\b/i, { kind: 'glossary', slug: 'closing-price' }],
  [/\bindex fund\b/i, { kind: 'glossary', slug: 'index-fund' }],
  [/\bPEG( ratio)?\b/, { kind: 'concept', slug: 'peg-ratio' }],
  [/\bP\/E( ratio)?/, { kind: 'concept', slug: 'pe-ratio' }],
  [/\bmarket cap\b/i, { kind: 'concept', slug: 'market-cap-vs-share-price' }],
  [/\bfree[- ]cash[- ]flow\b|\bfree cash\b/i, { kind: 'concept', slug: 'free-cash-flow' }],
  [/\bRule of 40\b/i, { kind: 'concept', slug: 'rule-of-40' }],
  [/\bpriced in\b|\balready in the price\b/i, { kind: 'concept', slug: 'already-priced-in' }],
  [/\breturn on invested capital\b|\bROIC\b|\breturn on equity\b/i, { kind: 'concept', slug: 'return-on-equity-roic' }],
  [/\bpeak of a boom\b|\bboom-and-bust\b|\bbooms and busts\b/i, { kind: 'concept', slug: 'peak-cycle-earnings' }],
  [/\bprofit margins?\b|\bmargins\b/i, { kind: 'concept', slug: 'profit-margins' }],
  [/\brevenue\b/i, { kind: 'concept', slug: 'revenue-vs-earnings' }],
  [/\bearnings\b/i, { kind: 'concept', slug: 'revenue-vs-earnings' }],
]

export function Linked({ text }: { text: string }) {
  const found: { start: number; end: number; key: Key }[] = []
  const seen = new Set<string>()
  for (const [re, key] of PATTERNS) {
    if (seen.has(key.slug)) continue
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')
    for (const m of text.matchAll(g)) {
      const start = m.index
      const end = start + m[0].length
      if (found.some((f) => start < f.end && end > f.start)) continue
      found.push({ start, end, key })
      seen.add(key.slug)
      break
    }
  }
  found.sort((a, b) => a.start - b.start)
  const out: ReactNode[] = []
  let at = 0
  for (const f of found) {
    out.push(text.slice(at, f.start))
    out.push(<Term key={f.start} k={f.key}>{text.slice(f.start, f.end)}</Term>)
    at = f.end
  }
  out.push(text.slice(at))
  return <>{out}</>
}

export function Term({ k, children }: { k: Key; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const { mark } = useGame()
  return (
    <>
      <button
        className="term"
        onClick={(e) => {
          e.stopPropagation()
          setOpen(true)
          if (k.kind === 'concept') mark(k.slug, 'encountered', 'tapped a term')
        }}
      >
        {children}
      </button>
      {open && (k.kind === 'concept'
        ? <ConceptSheet c={concept(k.slug)} onClose={() => setOpen(false)} />
        : <GlossarySheet slug={k.slug} onClose={() => setOpen(false)} />)}
    </>
  )
}

function GlossarySheet({ slug, onClose }: { slug: string; onClose: () => void }) {
  const t = glossaryTerm(slug)
  if (!t) return null
  return (
    <Sheet title={t.term} onClose={onClose}>
      <p>{t.explanation}</p>
      {t.example && <div className="term-box"><b>Example</b><p>{t.example}</p></div>}
    </Sheet>
  )
}

export function ConceptSheet({ c, onClose, children }: { c: Concept; onClose: () => void; children?: ReactNode }) {
  const { mark, state, go } = useGame()
  const q = c.check_questions[0]
  const lesson = lessonFor(c.slug)
  const [picked, setPicked] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const right = picked === q?.answer
  return (
    <Sheet title={c.name} onClose={onClose}>
      <p>{c.kid_explanation}</p>
      {!children && (lesson && isOpen(state, c) ? (
        <Button onClick={() => { onClose(); go('lesson', { lessonSlug: c.slug, lessonBack: state.screen === 'lesson' ? state.lessonBack : state.screen }) }}>
          📚 Go deeper: the {lesson.minutes}-minute lesson
        </Button>
      ) : (
        <Button kind="secondary" onClick={() => { onClose(); go('learn') }}>📚 See where it fits in Learn</Button>
      ))}
      {children}
      {c.whats_normal && <div className="term-box"><b>What's normal?</b><p>{c.whats_normal}</p></div>}
      {c.example && <div className="term-box"><b>Example</b><p>{c.example}</p></div>}
      {q && (
        <div className="quiz">
          <p className="eyebrow">Check yourself</p>
          <p><b>{q.question}</b></p>
          {q.choices.map((ch) => (
            <button
              key={ch}
              className={`quiz-choice ${picked === ch ? (right ? 'right' : 'wrong') : ''} ${picked && ch === q.answer ? 'right' : ''}`}
              disabled={!!picked}
              onClick={() => {
                setPicked(ch)
                if (ch === q.answer) mark(c.slug, 'explained', 'check question')
              }}
            >
              {ch}
            </button>
          ))}
          {picked && (
            <p className="quiz-why">
              {right ? '✅ ' : 'Not quite. '}{q.why}
              {right && !state.concepts[c.slug]?.applied && <><br /><b>Marked learned.</b> Use it in a thesis to count it for your rank.</>}
            </p>
          )}
        </div>
      )}
      {asking
        ? <CoachChat mode="explain" facts={{ slug: c.slug }} voiceSample={`Why does ${c.name.toLowerCase()} matter?`} />
        : <Button kind="secondary" onClick={() => setAsking(true)}>🧢 Ask the coach about this</Button>}
    </Sheet>
  )
}
