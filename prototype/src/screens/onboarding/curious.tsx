import { useState } from 'react'
import { Avatar, Card, Page, TopBar } from '../../components/ui'
import { notInGame, themes } from '../../content'
import { friendTheses } from '../../data/club'
import { findCompany, norm, searchCompanies } from '../../data/companies'
import { useGame } from '../../state/store'

export function CuriousScreen() {
  const { go } = useGame()
  const [q, setQ] = useState('')
  const [openTheme, setOpenTheme] = useState<string | null>(null)
  const matches = searchCompanies(q).slice(0, 5)
  const privateHit = notInGame.find((p) => q.length >= 3 && norm(p.name).startsWith(norm(q)))

  const openCompany = (ticker: string) => go('company', { companyTicker: ticker, companyBack: 'curious' })

  return (
    <Page>
      <TopBar back="market" />
      <p className="eyebrow">Step 2 of 3</p>
      <h1>What companies do you use, love, or think will be huge?</h1>
      <div className="search">
        <span aria-hidden>🔎</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Nvidia, Nike, SpaceX…" />
      </div>
      {(matches.length > 0 || privateHit) && (
        <div className="results">
          {privateHit && (
            <button className="result" onClick={() => go('private', { companyTicker: privateHit.name })}>
              <span className="tick">🚫</span>
              <span><b>{privateHit.name}</b><small>Private company · not on the stock market</small></span>
            </button>
          )}
          {matches.map((c) => (
            <button key={c.ticker} className="result" onClick={() => openCompany(c.ticker)}>
              <span className="tick">{c.ticker}</span>
              <span><b>{c.name}</b><small>{c.oneLiner}</small></span>
            </button>
          ))}
        </div>
      )}
      {q && !matches.length && !privateHit && <p className="muted">Not in this prototype's list. Try a theme below.</p>}

      <h2>Or pick a theme</h2>
      <div className="themes">
        {themes.map((t, i) => (
          <div key={t.name} className={`theme theme-${i % 5} ${openTheme === t.name ? 'open' : ''}`}>
            <button className="theme-head" onClick={() => setOpenTheme(openTheme === t.name ? null : t.name)}>
              <b>{t.name}</b>
              <small>{t.blurb.split('.')[0]}</small>
            </button>
            {openTheme === t.name && (
              <div className="theme-body">
                {t.tickers.map((tk) => findCompany(tk)).filter(Boolean).map((c) => (
                  <button key={c!.ticker} className="co-chip" onClick={() => openCompany(c!.ticker)}>
                    <b>{c!.name}</b><small>{c!.oneLiner}</small>
                  </button>
                ))}
                {notInGame.filter((p) => p.theme === t.name).map((p) => (
                  <button key={p.name} className="co-chip private" onClick={() => go('private', { companyTicker: p.name })}>
                    <b>🔒 {p.name}?</b><small>Why you can't buy it</small>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <h2>Why your friends bought</h2>
      <div className="scroller">
        {friendTheses.filter((t) => t.action === 'bought').map((t) => (
          <Card key={t.id} className="thesis-mini">
            <div className="row"><Avatar emoji={t.avatar} size={28} /><b>{t.who} bought {t.companyName}</b></div>
            <p>"{t.why}"</p>
          </Card>
        ))}
      </div>
    </Page>
  )
}
