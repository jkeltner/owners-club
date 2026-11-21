// The amount sliders move in $50 steps but must still reach both ends. Left to
// the browser, step="50" snaps the top to the last multiple of 50 under it
// ($950 of $995), so "all of it" could never be dragged back to. The input
// steps by $1 and this rounds to the nearest $50, keeping the top exact.
export const SLIDER_STEP = 50;

export function snapAmount(v: number, low: number, max: number): number {
  if (max - low < 100) return Math.round(v);
  if (v >= max - SLIDER_STEP / 2) return max;
  return Math.min(max, Math.max(low, Math.round(v / SLIDER_STEP) * SLIDER_STEP));
}
