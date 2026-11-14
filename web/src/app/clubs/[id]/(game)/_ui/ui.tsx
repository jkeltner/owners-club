// Small layout pieces shared by the game screens, ported from the prototype.
import Link from "next/link";
import type { ReactNode } from "react";
import { Term } from "./terms";

export function Page({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <main className={`screen ${className}`}>{children}</main>;
}

export function TopBar({ title, back }: { title?: string; back?: string }) {
  return (
    <header className="topbar">
      {back ? (
        <Link className="icon-btn" href={back} aria-label="Back">
          ←
        </Link>
      ) : (
        <span className="icon-btn ghost" />
      )}
      <span className="topbar-title">{title}</span>
      <span className="icon-btn ghost" />
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}

export function Avatar({ emoji, size = 40, you }: { emoji: string; size?: number; you?: boolean }) {
  return (
    <span className={`avatar ${you ? "avatar-you" : ""}`} style={{ width: size, height: size, fontSize: size * 0.55 }}>
      {emoji}
    </span>
  );
}

// A stat with a "what's this?" dot that opens the concept behind it.
export function Stat({ label, value, conceptSlug, sub }: { label: string; value: ReactNode; conceptSlug?: string; sub?: string }) {
  return (
    <div className="stat">
      <div className="stat-label">
        {label}
        {conceptSlug && (
          <Term k={{ kind: "concept", slug: conceptSlug }} className="info-dot" label={`What is ${label}?`}>
            ?
          </Term>
        )}
      </div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}
