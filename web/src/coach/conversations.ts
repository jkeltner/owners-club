// Coach conversations, stored turn by turn. Every message is written as it
// happens, so a refresh resumes mid-conversation (tester note, issue #5), and
// a conversation is only ever read through its owner's membership: the coach
// is private to the player, organizers included.
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { sectorPlural } from "@/content";
import { db } from "@/db";
import { conversations, messages, type CoachState } from "@/db/schema";
import { companyView, marketSnapshot, usualPe, type CompanyView, type MarketSnapshot } from "@/market/read";
import { coachReply, PRIVATE_SCRIPTS, type ChatMsg, type CoachCompany, type CoachContext, type ScriptedMode } from "./script";

export type Conversation = typeof conversations.$inferSelect;
export type Player = { membershipId: string; name: string; experience?: string | null };

export const MAX_MESSAGE = 500;

/** The company as the coach sees it: the same numbers its page shows. */
export function coachCompany(c: CompanyView, market: MarketSnapshot): CoachCompany {
  return {
    name: c.name,
    isAi: c.isAi,
    pe: c.metrics.pe,
    marketCap: c.metrics.marketCap,
    revenueTtm: c.metrics.revenueTtm,
    netIncomeTtm: c.metrics.netIncomeTtm,
    revenueGrowth: c.metrics.revenueGrowth,
    usualPe: usualPe(c.lens?.kind, market),
    kindPlural: c.lens ? sectorPlural(c.lens.kind) : undefined,
  };
}

const about = (mode: ScriptedMode, subject: string) =>
  mode === "pick" ? and(eq(conversations.ticker, subject), isNull(conversations.topic)) : and(eq(conversations.topic, subject), isNull(conversations.ticker));

/**
 * The player's conversation about this company: the one in progress if there
 * is one (a pick conversation is in progress until its thesis is attached to
 * a placed order), else a new one. `fresh` starts over.
 */
export async function openConversation(membershipId: string, mode: ScriptedMode, subject: string, fresh = false): Promise<Conversation> {
  if (!fresh) {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.membershipId, membershipId), eq(conversations.mode, mode), about(mode, subject), isNull(conversations.thesisId)))
      .orderBy(desc(conversations.updatedAt))
      .limit(1);
    if (existing) return existing;
  }
  const [created] = await db
    .insert(conversations)
    .values(mode === "pick" ? { membershipId, mode, ticker: subject } : { membershipId, mode, topic: subject })
    .returning();
  return created;
}

/** The latest conversation of this kind, without starting one. */
export async function findConversation(membershipId: string, mode: ScriptedMode, subject: string): Promise<Conversation | null> {
  const [existing] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.membershipId, membershipId), eq(conversations.mode, mode), about(mode, subject), isNull(conversations.thesisId)))
    .orderBy(desc(conversations.updatedAt))
    .limit(1);
  return existing ?? null;
}

/** A conversation and its messages, only for the membership that owns it. */
export async function readConversation(conversationId: string, membershipId: string): Promise<{ conversation: Conversation; log: ChatMsg[] } | null> {
  const [conversation] = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.membershipId, membershipId)));
  if (!conversation) return null;
  const rows = await db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.seq));
  return { conversation, log: rows.map((m) => ({ from: m.from, text: m.text })) };
}

async function contextFor(conversation: Conversation, player: Player): Promise<CoachContext | null> {
  const base = { playerName: player.name, experience: player.experience, turn: conversation.turn };
  if (conversation.mode === "private") {
    const facts = PRIVATE_SCRIPTS[conversation.topic ?? ""];
    return facts ? { ...base, mode: "private", marketPe: null, facts } : null;
  }
  if (conversation.mode !== "pick" || !conversation.ticker) return null;
  const [company, market] = await Promise.all([companyView(conversation.ticker), marketSnapshot()]);
  return company ? { ...base, mode: "pick", marketPe: market.marketPe, company: coachCompany(company, market) } : null;
}

export type Turn = { log: ChatMsg[]; state: CoachState; done: boolean };

/**
 * Moves a conversation forward and returns where it stands. With `input`, the
 * player's message is stored first. The coach then replies whenever it owes a
 * reply: at the start, after a player message, or after a reload that caught
 * it between the two. Calling it with nothing owed changes nothing.
 */
export async function coachTurn(conversationId: string, player: Player, input: string | null): Promise<Turn> {
  const found = await readConversation(conversationId, player.membershipId);
  if (!found) throw new Error("That conversation isn't yours");
  let { conversation } = found;
  const log = [...found.log];
  const text = input?.replace(/\s+/g, " ").trim().slice(0, MAX_MESSAGE);
  const last = log[log.length - 1];

  if (text && !conversation.done && last?.from === "coach") {
    await db.insert(messages).values({ conversationId, seq: log.length, from: "player", text });
    log.push({ from: "player", text });
  }

  const owed = !conversation.done && (log.length === 0 || log[log.length - 1].from === "player");
  if (owed) {
    const ctx = await contextFor(conversation, player);
    if (!ctx) throw new Error("The coach can't find what this conversation is about");
    const lastPlayer = log.length ? log[log.length - 1].text : null;
    const reply = coachReply(ctx, lastPlayer);
    await db.insert(messages).values(reply.bubbles.map((b, i) => ({ conversationId, seq: log.length + i, from: "coach" as const, text: b })));
    for (const b of reply.bubbles) log.push({ from: "coach", text: b });
    [conversation] = await db
      .update(conversations)
      .set({ turn: conversation.turn + 1, done: !!reply.done, state: { chips: reply.chips, tickers: reply.tickers }, updatedAt: new Date() })
      .where(eq(conversations.id, conversationId))
      .returning();
  }
  return { log, state: conversation.state ?? {}, done: conversation.done };
}
