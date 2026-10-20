// Feedback button on every screen. Notes save to localStorage with the screen
// name and a snapshot of the game; "Copy all" puts them on the clipboard and
// "Clear notes" empties the list (second tap confirms, no browser dialog).
// On the hosted site each note is also sent to /api/feedback, which files it
// on GitHub: one issue per tester per day, one comment per note. Notes that
// can't be sent (local dev, offline) stay here and retry later.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useGame, type FeedbackNote, type GameState } from '../state/store'
import { usd } from '../lib/format'
import { Button } from './ui'

const clip = (t: string, n = 140) => (t.length > n ? t.slice(0, n) + '…' : t)

function snapshot(s: GameState): string[] {
  const out: string[] = []
  if (s.companyTicker) out.push(`company: ${s.companyTicker}`)
  if (s.draft) {
    if (s.draft.thesis) out.push(`draft thesis: "${clip(s.draft.thesis)}"`)
    if (s.draft.prediction) out.push(`draft prediction: ${s.draft.prediction.label} ${s.draft.prediction.value}${s.draft.prediction.unit}`)
    if (s.screen === 'size') out.push(`slider: ${usd(s.draft.amount)}`)
  }
  if (s.pick) out.push(`pick: ${s.pick.ticker} ${usd(s.pick.amount)}, thesis "${clip(s.pick.thesis)}"`)
  for (const m of s.coachLog.slice(-4)) out.push(`${m.from}: ${clip(m.text)}`)
  const learned = Object.keys(s.concepts).filter((k) => s.concepts[k].explained || s.concepts[k].applied)
  if (learned.length) out.push(`concepts explained/applied: ${learned.join(', ')}`)
  if (s.soldDemo) out.push(`sell demo: ${s.soldDemo}`)
  if (s.scouts.length) out.push(`scouting reports: ${s.scouts.map((x) => x.ticker).join(', ')}`)
  if (s.lessonsDone.length) out.push(`lessons done: ${s.lessonsDone.join(', ')}`)
  if (s.screen === 'lesson' && s.lessonSlug) out.push(`in lesson: ${s.lessonSlug}`)
  if (s.screen === 'replay' && s.replaySlug) out.push(`in replay: ${s.replaySlug}`)
  if (s.replaysDone.length) out.push(`replays done: ${s.replaysDone.join(', ')}`)
  return out
}

const dayOf = (at: number) => new Date(at).toLocaleDateString('en-CA')

function useSender() {
  const { state, update } = useGame()
  const sending = useRef(false)
  return useCallback(async (notes: FeedbackNote[]) => {
    if (sending.current) return
    sending.current = true
    let issue = state.feedbackIssue
    try {
      for (const n of notes.filter((x) => !x.sent)) {
        const day = dayOf(n.at)
        const res = await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tester: state.testerId, issue: issue?.day === day ? issue.number : null, note: n.note, screen: n.screen, at: n.at, context: n.context ?? [] }),
        })
        if (!res.ok) break
        const { issue: number } = (await res.json()) as { issue: number }
        issue = { day, number }
        const sentIssue = issue
        update((s) => ({ feedback: s.feedback.map((f) => (f.at === n.at ? { ...f, sent: true } : f)), feedbackIssue: sentIssue }))
      }
    } catch {
      // No API here (local dev) or offline: the notes stay saved and retry later.
    } finally {
      sending.current = false
    }
  }, [state.feedbackIssue, state.testerId, update])
}

export function FeedbackButton() {
  const { state, update } = useGame()
  const send = useSender()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  // Retry anything unsent once per page load.
  const retried = useRef(false)
  useEffect(() => {
    if (retried.current) return
    retried.current = true
    if (state.feedback.some((f) => !f.sent)) void send(state.feedback)
  }, [send, state.feedback])

  const save = () => {
    if (!note.trim()) return
    const n: FeedbackNote = { screen: state.screen, note: note.trim(), at: Date.now(), context: snapshot(state) }
    update((s) => ({ feedback: [...s.feedback, n] }))
    void send([...state.feedback, n])
    setNote('')
    setOpen(false)
  }
  const unsent = state.feedback.filter((f) => !f.sent).length

  const clearAll = () => {
    if (!confirmClear) return setConfirmClear(true)
    update(() => ({ feedback: [] }))
    setConfirmClear(false)
  }

  const copyAll = async () => {
    const text = state.feedback
      .map((f) =>
        [`- [${new Date(f.at).toLocaleString()}] (${f.screen}) ${f.note}`, ...(f.context ?? []).map((c) => `    - ${c}`)].join('\n'),
      )
      .join('\n')
    try {
      await navigator.clipboard.writeText(text || '(no notes yet)')
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard blocked (e.g. not https): show the text so it can be copied by hand.
      setNote(text)
    }
  }

  return (
    <>
      <button className="feedback-fab" onClick={() => setOpen(true)} aria-label="Leave feedback">
        ✎<span className="sr">Feedback</span>
        {state.feedback.length > 0 && <span className="badge">{state.feedback.length}</span>}
      </button>
      {open && (
        <div className="sheet-backdrop" onClick={() => { setOpen(false); setConfirmClear(false) }}>
          <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Feedback">
            <div className="sheet-handle" />
            <h3>Note for the makers</h3>
            <p className="muted">Screen: <b>{state.screen}</b>. Confusing? Boring? Cool? Say anything.</p>
            <p className="muted small">Notes go to the makers on GitHub, where anyone can read them. Your name isn't included, so don't add it.</p>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="This part was…" autoFocus />
            <Button onClick={save} disabled={!note.trim()}>Save note</Button>
            <Button kind="ghost" onClick={copyAll}>
              {copied ? 'Copied!' : `Copy all notes (${state.feedback.length})`}
            </Button>
            {unsent > 0 && <p className="muted small center">{unsent} not sent yet. They'll go when the site can reach GitHub.</p>}
            {state.feedback.length > 0 && (
              <Button kind="ghost" onClick={clearAll}>
                {confirmClear ? `Tap again to delete ${state.feedback.length} notes` : 'Clear notes'}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
