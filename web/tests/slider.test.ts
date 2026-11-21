import { describe, expect, it } from "vitest";
import { snapAmount } from "@/lib/slider";

describe("amount sliders", () => {
  it("reach the exact top even when it isn't a multiple of $50", () => {
    expect(snapAmount(995, 100, 995)).toBe(995);
    expect(snapAmount(975, 100, 995.37)).toBe(995.37);
  });
  it("move in $50 steps in between, never under the bottom", () => {
    expect(snapAmount(523, 100, 995)).toBe(500);
    expect(snapAmount(101, 100, 995)).toBe(100);
    expect(snapAmount(140, 100, 995)).toBe(150);
    expect(snapAmount(980, 100, 995)).toBe(995);
    expect(snapAmount(965, 100, 995)).toBe(950);
  });
  it("move by the dollar on a short slider", () => {
    expect(snapAmount(163.4, 100, 180)).toBe(163);
  });
});
