// Small pieces shared by every lesson: a coach line, and a one-question pick
// where every choice gets its own reply (wrong answers teach too).
import { useState, type ReactNode } from 'react'
import { Linked } from './terms'

export function CoachSays({ children, text }: { children?: ReactNode; text?: string }) {
  return (
    <div className="bubble bubble-coach">
      <span className="coach-face">🧢</span>
      <span>{text ? <Linked text={text} /> : children}</span>
    </div>
  )
}

export type Option = { text: string; say: string; right?: boolean }

export function PickOne({ question, options, onAnswered }: { question: string; options: Option[]; onAnswered?: (o: Option) => void }) {
  const [picked, setPicked] = useState<Option | null>(null)
  return (
    <div className="quiz">
      <p><b>{question}</b></p>
      {options.map((o) => (
        <button
          key={o.text}
          className={`quiz-choice ${picked === o ? (o.right ? 'right' : 'wrong') : ''} ${picked && o.right ? 'right' : ''}`}
          disabled={!!picked}
          onClick={() => { setPicked(o); onAnswered?.(o) }}
        >
          {o.text}
        </button>
      ))}
      {picked && <p className="quiz-why">{picked.right ? '✅ ' : 'Not quite. '}<Linked text={picked.say} /></p>}
    </div>
  )
}
