"use client";
// Chat-style coach conversation with tap replies and typing. Every message is
// stored on the server as it's sent, so the page can be reloaded at any point
// and the conversation picks up where it was.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sayToCoach } from "../actions";
import { Linked } from "./terms";

type Msg = { from: "coach" | "player"; text: string };
type State = { chips?: string[]; tickers?: string[] };
export type TickerCard = { ticker: string; name: string; line: string; href: string };

type Props = {
  clubId: string;
  conversationId: string;
  log: Msg[];
  state: State;
  done: boolean;
  cards?: TickerCard[]; // companies the coach may point at, as tappable cards
  next?: { href: string; label: string }; // where the conversation hands over when it's done
};

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function CoachChat(props: Props) {
  const [log, setLog] = useState(props.log);
  const [state, setState] = useState(props.state);
  const [done, setDone] = useState(props.done);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState("");
  const [problem, setProblem] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const firstPaint = useRef(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      return;
    }
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [log, typing]);

  const send = async (raw: string) => {
    const msg = raw.trim();
    if (!msg || typing || done) return;
    const before = log;
    setLog([...log, { from: "player", text: msg }]);
    setText("");
    setProblem(false);
    setTyping(true);
    try {
      // A short pause so the reply reads as an answer, not a page update.
      const [turn] = await Promise.all([sayToCoach(props.clubId, props.conversationId, msg), pause(650)]);
      setLog(turn.log);
      setState(turn.state);
      setDone(turn.done);
    } catch {
      setLog(before);
      setText(msg);
      setProblem(true);
    }
    setTyping(false);
  };

  const shown = (state.tickers ?? []).map((t) => props.cards?.find((c) => c.ticker === t)).filter((c): c is TickerCard => !!c);

  return (
    <div className="chat">
      <div className="chat-log">
        {log.map((m, i) => (
          <div key={i} className={`bubble bubble-${m.from}`}>
            {m.from === "coach" && !(i > 0 && log[i - 1].from === "coach") && <span className="coach-face">🧢</span>}
            <span>{m.from === "coach" ? <Linked text={m.text} /> : m.text}</span>
          </div>
        ))}
        {typing && (
          <div className="bubble bubble-coach typing">
            <span className="coach-face">🧢</span>
            <span className="dots-typing">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}
        {shown.length > 0 && (
          <div className="ticker-cards">
            {shown.map((c) => (
              <Link key={c.ticker} className="co-chip" href={c.href}>
                <b>{c.name}</b>
                <small>{c.line}</small>
              </Link>
            ))}
          </div>
        )}
        {problem && <p className="notice">That didn&apos;t reach the coach. Check your connection and send it again.</p>}
        <div ref={endRef} />
      </div>
      {!done && (
        <div className="chat-input">
          {state.chips && !typing && (
            <div className="chips">
              {state.chips.map((c) => (
                <button key={c} type="button" className="chip" onClick={() => send(c)}>
                  {c}
                </button>
              ))}
            </div>
          )}
          <div className="compose">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(text)}
              placeholder="Type your answer, or tap one"
              aria-label="Your answer"
              maxLength={500}
            />
            <button type="button" className="send" onClick={() => send(text)} disabled={!text.trim() || typing} aria-label="Send">
              ↑
            </button>
          </div>
        </div>
      )}
      {done && props.next && (
        <div className="sticky-cta pop-in">
          <Link className="btn btn-primary" href={props.next.href}>
            {props.next.label}
          </Link>
        </div>
      )}
    </div>
  );
}
