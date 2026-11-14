"use client";
// The search box and the themes on the curiosity screen.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CompanyCard } from "@/market/read";
import { findCompanies } from "../actions";

// Lowercase letters and digits only, so "space x" finds SpaceX.
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

type Theme = { name: string; blurb: string; cards: CompanyCard[]; locked: string[] };

export function Finder({ clubId, themes, locked }: { clubId: string; themes: Theme[]; locked: string[] }) {
  const [q, setQ] = useState("");
  const [matches, setMatches] = useState<CompanyCard[]>([]);
  const [searched, setSearched] = useState("");
  const [openTheme, setOpenTheme] = useState<string | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    const text = q.trim();
    if (!text) return;
    const mine = ++latest.current;
    const timer = setTimeout(async () => {
      try {
        const found = await findCompanies(clubId, text);
        if (mine === latest.current) {
          setMatches(found);
          setSearched(text);
        }
      } catch {
        // A dropped connection: leave the last results up.
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [q, clubId]);

  const typed = q.trim();
  const shown = typed ? matches : [];
  // A company people ask for that isn't on the stock market: the lesson is why.
  const privateHit = locked.find((name) => typed.length >= 3 && norm(name).startsWith(norm(typed)));
  const company = (ticker: string) => `/clubs/${clubId}/company/${encodeURIComponent(ticker)}`;
  const priv = (name: string) => `/clubs/${clubId}/private/${encodeURIComponent(name)}`;

  return (
    <>
      <div className="search">
        <span aria-hidden>🔎</span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Try Nvidia, Nike, SpaceX…" aria-label="Search for a company" autoComplete="off" />
      </div>
      {(shown.length > 0 || privateHit) && (
        <div className="results">
          {privateHit && (
            <Link className="result" href={priv(privateHit)}>
              <span className="tick">🚫</span>
              <span>
                <b>{privateHit}</b>
                <small>Private company · not on the stock market</small>
              </span>
            </Link>
          )}
          {shown.map((c) => (
            <Link key={c.ticker} className="result" href={company(c.ticker)}>
              <span className="tick">{c.ticker}</span>
              <span>
                <b>{c.name}</b>
                <small>{c.line}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
      {typed && searched === typed && !shown.length && !privateHit && (
        <p className="muted">
          Nothing in the game matches that. You can buy the 500 companies in the S&amp;P 500; smaller companies, and ones from other countries, aren&apos;t in it.
        </p>
      )}

      <h2>Or pick a theme</h2>
      <div className="themes">
        {themes.map((t, i) => (
          <div key={t.name} className={`theme theme-${i % 5} ${openTheme === t.name ? "open" : ""}`}>
            <button type="button" className="theme-head" onClick={() => setOpenTheme(openTheme === t.name ? null : t.name)} aria-expanded={openTheme === t.name}>
              <b>{t.name}</b>
              <small>{t.blurb}</small>
            </button>
            {openTheme === t.name && (
              <div className="theme-body">
                {t.cards.map((c) => (
                  <Link key={c.ticker} className="co-chip" href={company(c.ticker)}>
                    <b>{c.name}</b>
                    <small>{c.line}</small>
                  </Link>
                ))}
                {t.locked.map((name) => (
                  <Link key={name} className="co-chip private" href={priv(name)}>
                    <b>🔒 {name}?</b>
                    <small>Why you can&apos;t buy it</small>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
