// All prototype state lives in the browser. Saved to localStorage so a reload
// mid-playtest keeps your place; "Restart" on the profile clears it.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { concept } from '../content'
import { chatSeed } from '../data/club'

export type Screen =
  | 'invite' | 'join' | 'market' | 'curious' | 'company' | 'private'
  | 'coach' | 'thesis' | 'size' | 'done'
  | 'feed' | 'portfolio' | 'sell' | 'board' | 'me'
  | 'learn' | 'lesson' | 'replay' | 'scouted'

export type ProgressLevel = 'encountered' | 'explained' | 'applied'
export const LEVELS: ProgressLevel[] = ['encountered', 'explained', 'applied']
export type Progress = Partial<Record<ProgressLevel, number>> & { evidence?: string[] }

export type ChatMsg = { from: 'coach' | 'player'; text: string }

export type Prediction = { metric: string; label: string; value: number; unit: string }

export type Pick = {
  ticker: string
  amount: number
  fee: number
  thesis: string
  prediction: Prediction
  at: number
}

// A thesis and prediction on a company the player didn't buy. Scored at
// earnings like a pick, and it counts for "applied" the same way.
export type Scout = { ticker: string; thesis: string; prediction: Prediction; at: number }

// context: a snapshot of the game at the moment the note was written, so a
// note like "the coach said something weird" shows what it said.
export type FeedbackNote = { screen: string; note: string; at: number; context?: string[] }

export type GameState = {
  screen: Screen
  name: string
  avatar: string
  companyTicker: string | null
  // Where the company screen's back arrow goes (onboarding vs. a tab).
  companyBack: Screen
  draft: { thesis: string; prediction: Prediction | null; amount: number; scout?: boolean } | null
  coachLog: ChatMsg[]
  pick: Pick | null
  scouts: Scout[]
  concepts: Record<string, Progress>
  feedback: FeedbackNote[]
  chat: { who: string; avatar: string; text: string }[]
  soldDemo: 'sold' | 'waited' | null
  timeMachineDone: boolean
  replaysDone: string[] // scenario slugs
  lessonsDone: string[] // concept slugs
  lessonSlug: string | null
  replaySlug: string | null
  unlockAll: boolean // prototype shortcut: open every lesson
  lessonBack: Screen // where a lesson's back button goes (Learn, or the screen a term was tapped on)
  learnIntroSeen: boolean // dismissed the "how ranks work" card on Learn
}

const STORAGE_KEY = 'owners_club_prototype_v1'

const initial = (): GameState => ({
  screen: 'invite',
  name: '',
  avatar: '🎧',
  companyTicker: null,
  companyBack: 'curious',
  draft: null,
  coachLog: [],
  pick: null,
  scouts: [],
  concepts: {},
  feedback: [],
  chat: chatSeed,
  soldDemo: null,
  timeMachineDone: false,
  replaysDone: [],
  lessonsDone: [],
  lessonSlug: null,
  replaySlug: null,
  unlockAll: false,
  lessonBack: 'learn',
  learnIntroSeen: false,
})

function load(): GameState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = { ...initial(), ...JSON.parse(raw) } as GameState
      // The Time machine tab became the Learn tab.
      if ((saved.screen as string) === 'time') saved.screen = 'learn'
      // Returning players with a portfolio start on the feed; anyone still
      // onboarding picks up where they left off.
      if (saved.pick) saved.screen = 'feed'
      return saved
    }
  } catch {
    // Private mode or blocked storage: start fresh.
  }
  return initial()
}

type Toast = { id: number; text: string; level: ProgressLevel }

type Ctx = {
  state: GameState
  update: (fn: (s: GameState) => Partial<GameState>) => void
  go: (screen: Screen, extra?: Partial<GameState>) => void
  mark: (slug: string, level: ProgressLevel, evidence?: string) => void
  reset: () => void
  toasts: Toast[]
}

const GameContext = createContext<Ctx | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(load)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastId = useRef(0)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Ignore: the prototype still works without saving.
    }
  }, [state])

  const update = useCallback((fn: (s: GameState) => Partial<GameState>) => {
    setState((s) => ({ ...s, ...fn(s) }))
  }, [])

  const go = useCallback((screen: Screen, extra?: Partial<GameState>) => {
    setState((s) => ({ ...s, ...extra, screen }))
    window.scrollTo({ top: 0 })
  }, [])

  // Marking a level also fills in the levels below it. Toasts only for news.
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  const mark = useCallback((slug: string, level: ProgressLevel, evidence?: string) => {
    if (stateRef.current.concepts[slug]?.[level]) return
    setState((s) => {
      const prev = s.concepts[slug] ?? {}
      if (prev[level]) return s
      const next: Progress = { ...prev, evidence: evidence ? [...(prev.evidence ?? []), evidence] : prev.evidence }
      for (const l of LEVELS.slice(0, LEVELS.indexOf(level) + 1)) next[l] ??= Date.now()
      return { ...s, concepts: { ...s.concepts, [slug]: next } }
    })
    // Encountered is tracked quietly; only learning and using a concept get a toast.
    if (level === 'encountered') return
    const id = ++toastId.current
    setToasts((t) => [...t.slice(-2), { id, text: concept(slug).name, level }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  const reset = useCallback(() => {
    setState((s) => ({ ...initial(), feedback: s.feedback }))
    window.scrollTo({ top: 0 })
  }, [])

  return (
    <GameContext.Provider value={{ state, update, go, mark, reset, toasts }}>
      {children}
    </GameContext.Provider>
  )
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame outside GameProvider')
  return ctx
}

export const levelOf = (p: Progress | undefined): ProgressLevel | null =>
  p?.applied ? 'applied' : p?.explained ? 'explained' : p?.encountered ? 'encountered' : null
