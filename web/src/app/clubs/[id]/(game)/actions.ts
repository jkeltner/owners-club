"use server";
// Everything a player does on the game screens. Each action re-checks who is
// asking and that they play in this club; the pick functions re-check the
// rules, whatever the screen allowed.
import { redirect } from "next/navigation";
import { coachTurn, openConversation, type Turn } from "@/coach/conversations";
import { numberStarters, type Parts } from "@/game/thesis_text";
import { cancelOrder, PickError, placeBuy, placeSell, saveDraft } from "@/game/picks";
import { companyCards, companyView, searchCards, type CompanyCard } from "@/market/read";
import { clubPath, companyPath, requirePlayer } from "./_lib/player";

const str = (f: FormData, key: string) => String(f.get(key) ?? "");

/** The curiosity screen's search box. */
export async function findCompanies(clubId: string, q: string): Promise<CompanyCard[]> {
  await requirePlayer(clubId, clubPath(clubId, "/pick"));
  return searchCards(await companyCards(), q.slice(0, 60));
}

/** One message to the coach; returns the conversation as it now stands. */
export async function sayToCoach(clubId: string, conversationId: string, text: string): Promise<Turn> {
  const { membership, experience } = await requirePlayer(clubId, clubPath(clubId));
  return coachTurn(conversationId, { membershipId: membership.id, name: membership.displayName, experience }, text);
}

/** Throws away the conversation in progress about a company and starts a new one. */
export async function startOver(f: FormData) {
  const clubId = str(f, "clubId");
  const ticker = str(f, "ticker");
  const here = companyPath(clubId, ticker, "/coach");
  const { membership } = await requirePlayer(clubId, here);
  await openConversation(membership.id, "pick", ticker, true);
  redirect(here);
}

export type FormState = { problem?: string };

/** Saves the three-part thesis and the prediction, then moves on to "how much?". */
export async function saveThesis(_prev: FormState, f: FormData): Promise<FormState> {
  const clubId = str(f, "clubId");
  const ticker = str(f, "ticker");
  const { membership } = await requirePlayer(clubId, companyPath(clubId, ticker, "/thesis"));
  const company = await companyView(ticker);
  if (!company) return { problem: "That company isn't in the game" };
  const starters = numberStarters({ name: company.name, pe: company.metrics.pe, netIncomeTtm: company.metrics.netIncomeTtm, revenueGrowth: company.metrics.revenueGrowth, netMargin: company.metrics.netMargin });
  try {
    await saveDraft(membership.id, company.ticker, { parts: [str(f, "part0"), str(f, "part1"), str(f, "part2")] as Parts, metric: str(f, "metric"), value: Number(str(f, "value")) }, starters);
  } catch (err) {
    if (err instanceof PickError) return { problem: err.message };
    throw err;
  }
  redirect(companyPath(clubId, company.ticker, "/size"));
}

/** Places the buy order. It waits for the next market close. */
export async function buy(_prev: FormState, f: FormData): Promise<FormState> {
  const clubId = str(f, "clubId");
  const ticker = str(f, "ticker");
  const { membership, club } = await requirePlayer(clubId, companyPath(clubId, ticker, "/size"));
  let orderId: string;
  let first: boolean;
  try {
    const placed = await placeBuy(membership, club.settings, ticker, Number(str(f, "amount")));
    orderId = placed.order.id;
    first = placed.first;
  } catch (err) {
    if (err instanceof PickError) return { problem: err.message };
    throw err;
  }
  redirect(clubPath(clubId, `/orders/${orderId}${first ? "?first=1" : ""}`));
}

/** Takes back an order that is still waiting for the market to close. */
export async function cancelWaitingOrder(_prev: FormState, f: FormData): Promise<FormState> {
  const clubId = str(f, "clubId");
  const orderId = str(f, "orderId");
  const here = clubPath(clubId, `/orders/${orderId}`);
  const { membership } = await requirePlayer(clubId, here);
  try {
    await cancelOrder(orderId, membership.id);
  } catch (err) {
    if (err instanceof PickError) return { problem: err.message };
    throw err;
  }
  redirect(here);
}

/** Places a sell order. It waits for the next market close, like a buy. */
export async function sell(_prev: FormState, f: FormData): Promise<FormState> {
  const clubId = str(f, "clubId");
  const ticker = str(f, "ticker");
  const { membership, club } = await requirePlayer(clubId, companyPath(clubId, ticker, "/sell"));
  let orderId: string;
  try {
    orderId = (await placeSell(membership, club.settings, ticker, Number(str(f, "amount")))).id;
  } catch (err) {
    if (err instanceof PickError) return { problem: err.message };
    throw err;
  }
  redirect(clubPath(clubId, `/orders/${orderId}`));
}
