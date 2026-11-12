// Number formatting, ported from the prototype. No red or green anywhere: a
// signed number reads the same whichever way it points.
export const usd = (n: number, cents = false) =>
  n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });

// $4.4T, $187B, $850M
export function bigUsd(billions: number): string {
  const sign = billions < 0 ? "−" : "";
  const b = Math.abs(billions);
  if (b >= 1000) return `${sign}$${(b / 1000).toFixed(1)}T`;
  if (b >= 1) return `${sign}$${b >= 100 ? b.toFixed(0) : b.toFixed(1)}B`;
  return `${sign}$${(b * 1000).toFixed(0)}M`;
}

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

// Signed, using a real minus sign.
export const signedPct = (n: number, digits = 1) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toFixed(digits)}%`;

export const signedUsd = (n: number) => `${n >= 0 ? "+" : "−"}${usd(Math.abs(n))}`;

// A P/E above this is shown as "over 100", not the number. Profit that small
// against the price makes the exact figure noise (312 or 480 says the same
// thing), and the useful question is why: an expensive stock, or a year when
// something unusual hit profit. Decision log: "P/E shown to players".
export const PE_SHOWN_UP_TO = 100;

export function peLabel(pe: number | null | undefined): string | null {
  if (pe == null) return null;
  return pe > PE_SHOWN_UP_TO ? `over ${PE_SHOWN_UP_TO}` : pe.toFixed(1);
}

export const isPeOffScale = (pe: number | null | undefined) => pe != null && pe > PE_SHOWN_UP_TO;
