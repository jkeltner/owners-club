// All prototype state lives in the browser. Saved to localStorage so a reload
// mid-playtest keeps your place; "Restart" on the profile clears it.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { concept } from '../content'
import { chatSeed } from '../data/club'
import type { CoachReply } from '../coach/coach'

export type Screen =
  | 'invite' | 'join' | 'level' | 'market' | 'curious' | 'company' | 'private'
  | 'coach' | 'thesis' | 'size' | 'done'
  | 'feed' | 'portfolio' | 'sell' | 'board' | 'me'
  | 'learn' | 'lesson' | 'replay' | 'scouted'

export type ProgressLevel = 'encountered' | 'explained' | 'applied'
export const LEVELS: ProgressLevel[] = ['encountered', 'explained', 'applied']
export type Progress = Partial<Record<ProgressLevel, number>> & { evidence?: string[] }

// How much the player already knows, asked once after joining. It sets how
// much the coach explains and where lessons start; changeable in Profile.
export type Experience = 'new' | 'some' | 'lots'

export type ChatMsg = { from: 'coach' | 'player'; text: string }

// Where a coach conversation stands, so a reload mid-chat resumes instead of
// starting over (tester note, issue #5). `key` says which conversation the
// saved coachLog belongs to (mode, company, facts); `reply` is the coach's
// last turn with its tap chips, or null while the coach owes a reply.
export type CoachSession = { key: string; turn: number; reply: CoachReply | null }

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
export type FeedbackNote = { screen: string; note: string; at: number; context?: string[]; sent?: boolean }

export type GameState = {
  screen: Screen
  name: string
  avatar: string
  experience: Experience | null
  companyTicker: string | null
  // Where the company screen's back arrow goes (onboarding vs. a tab).
  companyBack: Screen
  // scout: a scouting report, no money. focus: the concept the coach walks
  // through first. fromScout: a saved scouting report being turned into a pick.
  draft: { thesis: string; prediction: Prediction | null; amount: number; scout?: boolean; focus?: string; fromScout?: boolean } | null
  coachLog: ChatMsg[]
  coachSession: CoachSession | null
  pick: Pick | null
  morePicks: Pick[] // picks after the first; the first stays in `pick` (it sets the Shareholder rank)
  scouts: Scout[]
  comments: Record<string, { who: string; text: string }[]> // the player's replies on feed theses, by thesis id
  votes: Record<string, 'holds' | 'breaks'> // showdown votes on clubmates' predictions, by thesis id
  concepts: Record<string, Progress>
  feedback: FeedbackNote[]
  testerId: string // random, so GitHub issues group a tester's notes without a name
  feedbackIssue: { day: string; number: number } | null // today's GitHub issue for this tester
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
  experience: null,
  companyTicker: null,
  companyBack: 'curious',
  draft: null,
  coachLog: [],
  coachSession: null,
  pick: null,
  morePicks: [],
  scouts: [],
  comments: {},
  votes: {},
  concepts: {},
  feedback: [],
  testerId: Math.random().toString(36).slice(2, 8),
  feedbackIssue: null,
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
    setState((s) => ({ ...initial(), feedback: s.feedback, testerId: s.testerId, feedbackIssue: s.feedbackIssue }))
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
