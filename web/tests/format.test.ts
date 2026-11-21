import { describe, expect, it } from "vitest";
import { aboutShares, isBehindMarket, versusMarket } from "@/lib/format";

describe("you vs. the market", () => {
  it("reads Even only for a real tie", () => {
    expect(versusMarket(0)).toBe("Even");
    expect(versusMarket(0.004)).toBe("Even");
    expect(isBehindMarket(-0.004)).toBe(false);
  });
  it("shows a fee-sized gap with two decimals, and puts it below the line", () => {
    expect(versusMarket(-0.04)).toBe("−0.04%");
    expect(isBehindMarket(-0.04)).toBe(true);
    expect(versusMarket(0.06)).toBe("+0.06%");
  });
  it("uses one decimal once the gap is a tenth of a point or more", () => {
    expect(versusMarket(-1.234)).toBe("−1.2%");
  });
});

describe("share counts", () => {
  it("rounds and says about", () => {
    expect(aboutShares(0.90279)).toBe("about 0.90 shares");
    expect(aboutShares(12.345)).toBe("about 12.3 shares");
  });
});
