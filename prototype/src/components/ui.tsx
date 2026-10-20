import { useState, type ReactNode } from 'react'
import { concept } from '../content'
import { ConceptSheet } from './terms'
import { levelOf, useGame, type ProgressLevel, type Screen } from '../state/store'

export function Page({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`screen ${className}`}>{children}</main>
}

export function TopBar({ title, back, right }: { title?: string; back?: Screen; right?: ReactNode }) {
  const { go } = useGame()
  return (
    <header className="topbar">
      {back ? (
        <button className="icon-btn" onClick={() => go(back)} aria-label="Back">←</button>
      ) : <span className="icon-btn ghost" />}
      <span className="topbar-title">{title}</span>
      {right ?? <span className="icon-btn ghost" />}
    </header>
  )
}

export function Button({ children, onClick, kind = 'primary', disabled, className = '' }: {
  children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'gold'; disabled?: boolean; className?: string
}) {
  return (
    <button className={`btn btn-${kind} ${className}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return onClick ? (
    <button className={`card card-tap ${className}`} onClick={onClick}>{children}</button>
  ) : (
    <section className={`card ${className}`}>{children}</section>
  )
}

export function Avatar({ emoji, size = 40, you }: { emoji: string; size?: number; you?: boolean }) {
  return (
    <span className={`avatar ${you ? 'avatar-you' : ''}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {emoji}
    </span>
  )
}

export function Chip({ children, onClick, active }: { children: ReactNode; onClick?: () => void; active?: boolean }) {
  return <button className={`chip ${active ? 'chip-active' : ''}`} onClick={onClick}>{children}</button>
}

// A stat with a "what's this?" sheet for its concept.
export function Stat({ label, value, conceptSlug, sub }: { label: string; value: ReactNode; conceptSlug?: string; sub?: string }) {
  const [open, setOpen] = useState(false)
  const { mark } = useGame()
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {conceptSlug && (
          <button className="info-dot" aria-label={`What is ${label}?`} onClick={() => { setOpen(true); mark(conceptSlug, 'encountered') }}>?</button>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
      {open && conceptSlug && <ConceptSheet c={concept(conceptSlug)} onClose={() => setOpen(false)} />}
    </div>
  )
}

export function Sheet({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <h3>{title}</h3>
        {children}
        <Button kind="secondary" onClick={onClose}>Got it</Button>
      </div>
    </div>
  )
}

export function LevelDots({ slug }: { slug: string }) {
  const { state } = useGame()
  const level = levelOf(state.concepts[slug])
  const n = level === 'applied' ? 3 : level === 'explained' ? 2 : level === 'encountered' ? 1 : 0
  return (
    <span className="dots" aria-label={level ?? 'not yet'}>
      {[0, 1, 2].map((i) => <span key={i} className={i < n ? 'on' : ''} />)}
    </span>
  )
}

const TOAST_LABEL: Record<ProgressLevel, string> = { encountered: 'Spotted', explained: '💡 Learned', applied: '🛠️ You used' }

export function Toasts() {
  const { toasts } = useGame()
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.level}`}>
          <span>{TOAST_LABEL[t.level]}: <b>{t.text}</b></span>
        </div>
      ))}
    </div>
  )
}

const TABS: { screen: Screen; label: string; icon: string }[] = [
  { screen: 'feed', label: 'Club', icon: '💬' },
  { screen: 'portfolio', label: 'Portfolio', icon: '🧺' },
  { screen: 'board', label: 'Board', icon: '🏆' },
  { screen: 'learn', label: 'Learn', icon: '📚' },
  { screen: 'me', label: 'Me', icon: '🎖️' },
]

export function TabBar() {
  const { state, go } = useGame()
  const current = state.screen === 'sell' ? 'portfolio'
    : ['lesson', 'replay', 'scouted'].includes(state.screen) ? 'learn'
      : state.screen === 'company' ? state.companyBack
        : state.screen
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <button key={t.screen} className={current === t.screen ? 'on' : ''} onClick={() => go(t.screen)}>
          <span className="tab-icon">{t.icon}</span>
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}

export function FakeDataNote() {
  return <p className="fine">Prototype: every number here is made up.</p>
}
