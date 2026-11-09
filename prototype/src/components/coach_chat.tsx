// Chat-style coach conversation with tap replies, typing, and a mock mic.
//
// The conversation is saved to the store after every message (log, turn and
// the coach's last reply), keyed by mode, company and facts. Mounting with a
// matching key resumes where the player left off, so a page refresh doesn't
// restart the chat. Screens that start a new conversation reset `coachLog`.
// The term-sheet mini-chat (`explain`) is the exception: it's a side
// conversation and must not overwrite the pick conversation the thesis
// screen reads.
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

function sessionKey(mode: CoachMode, company?: Company, facts?: Record<string, string>) {
  return `${mode}|${company?.ticker ?? ''}|${JSON.stringify(facts ?? {})}`
}

export function CoachChat({ mode, company, facts, voiceSample, onDone, renderTickers }: Props) {
  const { state, mark, update } = useGame()
  const persist = mode !== 'explain'
  const key = sessionKey(mode, company, facts)
  // A saved conversation for this same moment: resume it.
  const saved = persist && state.coachSession?.key === key && state.coachLog.length ? state.coachSession : null
  const savedLog = saved ? state.coachLog : []
  const savedLast = savedLog[savedLog.length - 1]
  const [log, setLog] = useState<ChatMsg[]>(savedLog)
  const [turn, setTurn] = useState(saved?.turn ?? 0)
  const [typing, setTyping] = useState(!saved || savedLast?.from === 'player')
  const [reply, setReply] = useState<CoachReply | null>(saved?.reply ?? null)
  const [text, setText] = useState('')
  const [listening, setListening] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const started = useRef(false)

  const run = async (input: string | null, history: ChatMsg[], t: number) => {
    setTyping(true)
    const ctx: CoachContext = { mode, playerName: state.name || 'friend', experience: state.experience, company, history, turn: t, facts }
    const r = await askCoach(ctx, input)
    r.marks?.forEach((m) => mark(m.slug, m.level, `coach:${mode}`))
    const next = [...history, ...r.bubbles.map((b) => ({ from: 'coach' as const, text: b }))]
    setLog(next)
    // Saved so a reload resumes here, and so a feedback note can show what the coach said.
    if (persist) update(() => ({ coachLog: next, coachSession: { key, turn: t + 1, reply: r } }))
    setReply(r)
    setTurn(t + 1)
    setTyping(false)
    if (r.done) onDone?.(next)
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!saved) {
      run(null, [], 0)
    } else if (savedLast?.from === 'player') {
      // Reloaded while the coach was typing: answer the player's last message.
      run(savedLast.text, savedLog, saved.turn)
    } else if (saved.reply?.done) {
      onDone?.(savedLog)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [log, typing])

  const send = (msg: string) => {
    if (!msg.trim() || typing || reply?.done) return
    const next = [...log, { from: 'player' as const, text: msg.trim() }]
    setLog(next)
    if (persist) update(() => ({ coachLog: next, coachSession: { key, turn, reply: null } }))
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
