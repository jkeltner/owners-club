import { useState } from 'react'
import { Avatar, Button, Page } from '../../components/ui'
import { CLUB_NAME, INVITER, friends } from '../../data/club'
import { useGame } from '../../state/store'

export function InviteScreen() {
  const { go } = useGame()
  const alex = friends.find((f) => f.name === INVITER)!
  return (
    <Page className="hero-screen">
      <div className="invite-card">
        <div className="club-crest">OC</div>
        <p className="eyebrow">You're invited</p>
        <h1><Avatar emoji={alex.avatar} size={36} /> {INVITER} invited you to <span className="hl">{CLUB_NAME}</span></h1>
        <div className="avatar-row">
          {friends.map((f) => <Avatar key={f.id} emoji={f.avatar} size={44} />)}
        </div>
        <p className="muted">{friends.length} friends are already in. Beat the market, then beat your friends.</p>
      </div>
      <Button onClick={() => go('join')}>Join the club</Button>
    </Page>
  )
}

// Placeholder set; students should pick the real one.
const AVATARS = ['🎧', '🛹', '🏀', '🎮', '⚽', '🎨', '🚀', '🧠', '🦈', '🌵', '🍕', '💎']

export function JoinScreen() {
  const { state, go, update, mark } = useGame()
  const [name, setName] = useState(state.name)
  const [avatar, setAvatar] = useState(state.avatar)
  const ok = name.trim().length >= 2
  return (
    <Page>
      <h1>Pick your look</h1>
      <div className="avatar-preview"><Avatar emoji={avatar} size={96} you /></div>
      <label className="field">
        <span>Display name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={16} placeholder="What should friends call you?" autoFocus />
      </label>
      <div className="avatar-grid">
        {AVATARS.map((a) => (
          <button key={a} className={`avatar-pick ${a === avatar ? 'on' : ''}`} onClick={() => setAvatar(a)} aria-label={`Avatar ${a}`}>{a}</button>
        ))}
      </div>
      <Button
        disabled={!ok}
        onClick={() => {
          update(() => ({ name: name.trim(), avatar }))
          mark('index-as-benchmark', 'encountered', 'account created (starts in the index)')
          go('market')
        }}
      >
        That's me
      </Button>
    </Page>
  )
}
