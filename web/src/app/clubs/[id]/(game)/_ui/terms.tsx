"use client";
// Tappable terms. <Linked text="..."/> finds known terms in any sentence (coach
// bubbles, the sector lens, the rules) and makes the first mention of each one
// open a sheet with the plain explanation, what's normal and an example. The
// check question, the lesson link and "ask the coach" join the sheet when the
// Learn tab and the live coach are built.
import { createContext, useContext, useState, type ReactNode } from "react";
import { PATTERNS, termId, type TermBook, type TermKey } from "./term_patterns";

const Book = createContext<TermBook>({});

export function TermsProvider({ book, children }: { book: TermBook; children: ReactNode }) {
  return <Book.Provider value={book}>{children}</Book.Provider>;
}

export function Linked({ text }: { text: string }) {
  const book = useContext(Book);
  const found: { start: number; end: number; key: TermKey }[] = [];
  const seen = new Set<string>();
  for (const [re, key] of PATTERNS) {
    if (seen.has(key.slug) || !book[termId(key)]) continue;
    const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    for (const m of text.matchAll(g)) {
      const start = m.index;
      const end = start + m[0].length;
      if (found.some((f) => start < f.end && end > f.start)) continue;
      found.push({ start, end, key });
      seen.add(key.slug);
      break;
    }
  }
  found.sort((a, b) => a.start - b.start);
  const out: ReactNode[] = [];
  let at = 0;
  for (const f of found) {
    out.push(text.slice(at, f.start));
    out.push(
      <Term key={f.start} k={f.key}>
        {text.slice(f.start, f.end)}
      </Term>,
    );
    at = f.end;
  }
  out.push(text.slice(at));
  return <>{out}</>;
}

export function Term({ k, children, className = "term", label }: { k: TermKey; children: ReactNode; className?: string; label?: string }) {
  const book = useContext(Book);
  const [open, setOpen] = useState(false);
  const card = book[termId(k)];
  if (!card) return <>{children}</>;
  return (
    <>
      <button
        type="button"
        className={className}
        aria-label={label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
      >
        {children}
      </button>
      {open && (
        <Sheet title={card.title} onClose={() => setOpen(false)}>
          <p>{card.body}</p>
          {card.normal && (
            <div className="term-box">
              <b>What&apos;s normal?</b>
              <p>{card.normal}</p>
            </div>
          )}
          {card.example && (
            <div className="term-box">
              <b>Example</b>
              <p>{card.example}</p>
            </div>
          )}
        </Sheet>
      )}
    </>
  );
}

export function Sheet({ children, title, onClose }: { children: ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <h3>{title}</h3>
        {children}
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}

// An explainer card that opens and closes: the teaser line with + when closed,
// the title with − when open.
export function Fold({ startOpen, title, teaser, children }: { startOpen: boolean; title: string; teaser: ReactNode; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen);
  return (
    <section className="card how-it-works">
      <button type="button" className="why-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>{open ? <b className="fold-title">{title}</b> : teaser}</span>
        <span aria-hidden>{open ? "−" : "+"}</span>
      </button>
      {open && children}
    </section>
  );
}
