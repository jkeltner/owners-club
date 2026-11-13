// A club's game settings, as an organizer may set them. The defaults are the
// concept doc's; the limits keep a typo from making a game nobody can play.
import { DEFAULT_SETTINGS, type GameSettings } from "@/lib/rules";

type Limit = { min: number; max: number; whole?: boolean };

export const SETTING_LIMITS: Record<keyof GameSettings, Limit> = {
  capAtPurchase: { min: 0.05, max: 1 },
  minHoldDays: { min: 0, max: 365, whole: true },
  feeRate: { min: 0, max: 0.05 },
  shortTermTaxRate: { min: 0, max: 0.9 },
  longTermTaxRate: { min: 0, max: 0.9 },
  longTermAfterDays: { min: 1, max: 730, whole: true },
};

/** Fills gaps with the defaults and pulls each value inside its limits. */
export function cleanSettings(input: Partial<Record<keyof GameSettings, unknown>> = {}): GameSettings {
  const out = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(SETTING_LIMITS) as (keyof GameSettings)[]) {
    const n = Number(input[key]);
    if (input[key] == null || input[key] === "" || !Number.isFinite(n)) continue;
    const { min, max, whole } = SETTING_LIMITS[key];
    const clamped = Math.min(max, Math.max(min, n));
    out[key] = whole ? Math.round(clamped) : clamped;
  }
  return out;
}
