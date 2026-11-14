// The numbers beside each line of a sector lens's "what matters" panel. Only
// what we can compute from stored filings gets a value; a metric that comes
// from the company's own reports (same-store sales, subscribers, backlog) is
// named with no number rather than a made-up one. Keys are the labels in
// content/sector_lenses.yaml; a label with no entry here shows no value.
import { bigUsd } from "@/lib/format";
import type { CompanyMetrics } from "./metrics";

export type LensValue = { value: string; sub?: string };

const cents = (pct: number) => `${Math.round(pct)}¢ of each $1 of sales`;
const pct = (n: number) => `${Math.round(n)}%`;

const fcf = (m: CompanyMetrics): LensValue | null => {
  if (m.fcfTtm == null) return null;
  if (m.fcfTtm < 0) return { value: bigUsd(m.fcfTtm / 1e9), sub: "more cash went out than came in" };
  return { value: bigUsd(m.fcfTtm / 1e9), sub: m.fcfMargin != null ? cents(m.fcfMargin) : undefined };
};

const BY_LABEL: Record<string, (m: CompanyMetrics) => LensValue | null> = {
  "Revenue growth plus free-cash-flow margin (Rule of 40)": (m) =>
    m.ruleOf40 == null ? null : { value: String(Math.round(m.ruleOf40)), sub: `${pct(m.revenueGrowth!)} growth + ${pct(m.fcfMargin!)} free-cash margin` },
  "Gross margin": (m) => (m.grossMargin == null ? null : { value: pct(m.grossMargin), sub: cents(m.grossMargin) }),
  "Operating margin": (m) => (m.operatingMargin == null ? null : { value: pct(m.operatingMargin), sub: cents(m.operatingMargin) }),
  Margins: (m) => (m.netMargin == null ? null : { value: pct(m.netMargin), sub: "profit from each $1 of sales" }),
  "Cash conversion": (m) =>
    m.cashConversion == null || (m.netIncomeTtm ?? 0) <= 0 ? null : { value: pct(m.cashConversion * 100), sub: "of profit showed up as cash" },
  "Free cash flow": fcf,
  "Free cash flow across the boom-and-bust cycle": (m) => {
    const v = fcf(m);
    return v && { ...v, sub: v.sub ? `${v.sub} this year; check the bad years too` : "this year; check the bad years too" };
  },
  "Free-cash-flow yield": (m) =>
    m.fcfTtm == null || !m.marketCap ? null : { value: `${((m.fcfTtm / m.marketCap) * 100).toFixed(1)}%`, sub: "cash left over each year, per $100 the whole company costs" },
  "Return on equity, price-to-tangible-book": (m) => (m.roe == null ? null : { value: pct(m.roe), sub: "profit a year per $100 the owners have put in" }),
  Debt: (m) => (m.longTermDebt == null ? null : { value: bigUsd(m.longTermDebt / 1e9), sub: m.cash != null ? `against ${bigUsd(m.cash / 1e9)} in cash` : undefined }),
};

export const LENS_LABELS_WITH_VALUES = Object.keys(BY_LABEL);

export function lensValue(label: string, m: CompanyMetrics): LensValue | null {
  return BY_LABEL[label]?.(m) ?? null;
}
