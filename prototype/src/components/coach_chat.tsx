// Chat-style coach conversation with tap replies, typing, and a mock mic.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { askCoach, type CoachContext, type CoachMode, type CoachReply } from '../coach/coach'
import type { Company } from '../data/companies'
import { useGame, type ChatMsg } from '../state/store'
import { Linked } from './terms'

type Props = {
  mode: CoachMode
  company?: Company
  facts?: Record<string, string>
  voiceSample?: string
  onDone?: (log: ChatMsg[]) => void
  renderTickers?: (tickers: string[]) => ReactNode
}

export function CoachChat({ mode, company, facts, voiceSample, onDone, renderTickers }: Props) {
  const { state, mark, update } = useGame()
  const [log, setLog] = useState<ChatMsg[]>([])
  const [turn, setTurn] = useState(0)
  const [typing, setTyping] = useState(true)
  const [reply, setReply] = useState<CoachReply | null>(null)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const run = async (input: string | null, history: ChatMsg[], t: number) => {
    setTyping(true)
    const ctx: CoachContext = { mode, playerName: state.name || 'friend', company, history, turn: t, facts }
    const r = await askCoach(ctx, input)
    r.marks?.forEach((m) => mark(m.slug, m.level, `coach:${mode}`))
    const next = [...history, ...r.bubbles.map((b) => ({ from: 'coach' as const, text: b }))]
    setLog(next)
    update(() => ({ coachLog: next })) // so a feedback note can show what the coach said
    setReply(r)
    setTurn(t + 1)
    setTyping(false)
    if (r.done) onDone?.(next)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    run(null, [], 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log, typing])

  const send = (msg: string) => {
    if (!msg.trim() || typing || reply?.done) return
    const next = [...log, { from: 'player' as const, text: msg.trim() }]
    setLog(next)
    setText('')
    setReply(null)
    run(msg.trim(), next, turn)
  }

  const mic = () => {
    if (listening) return
    setListening(true)
    setTimeout(() => {
      setListening(false)
      setText(voiceSample ?? 'I think more people are going to want this')
    }, 1600)
  }

  const done = reply?.done
  return (
    <div className="chat">
      <div className="chat-log">
        {log.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.from}`}>
            {m.from === 'coach' && i > 0 && log[i - 1].from === 'coach' ? null : m.from === 'coach' ? <span className="coach-face">🧢</span> : null}
            <span>{m.from === 'coach' ? <Linked text={m.text} /> : m.text}</span>
          </div>
        ))}
        {typing && <div className="bubble bubble-coach typing"><span className="coach-face">🧢</span><span className="dots-typing"><i /><i /><i /></span></div>}
        {reply?.tickers && renderTickers?.(reply.tickers)}
        <div ref={endRef} />
      </div>
      {!done && (
        <div className="chat-input">
          {reply?.chips && !typing && (
            <div className="chips">
              {reply.chips.map((c) => <button key={c} className="chip" onClick={() => send(c)}>{c}</button>)}
            </div>
          )}
          <div className="compose">
            <button className={`mic ${listening ? 'listening' : ''}`} onClick={mic} aria-label="Talk instead of typing">
              {listening ? '●' : '🎙️'}
            </button>
            <input
              value={listening ? 'Listening…' : text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send(text)}
              placeholder="Type or tap the mic"
              disabled={listening}
            />
            <button className="send" onClick={() => send(text)} disabled={!text.trim() || typing} aria-label="Send">↑</button>
          </div>
        </div>
      )}
    </div>
  )
}
