import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "@/lib/brand";
import { formatProbability, formatProjectedRecord } from "@/lib/results/format";
import { isPerfectProjectedSeason, resultTierFromProjectedWins } from "@/lib/results/tiers";

describe("result presentation helpers", () => {
  it("maps projected wins onto presentation-only tiers", () => {
    expect(resultTierFromProjectedWins(4).label).toBe("ROUGH SEASON");
    expect(resultTierFromProjectedWins(8).label).toBe("COMPETITIVE");
    expect(resultTierFromProjectedWins(11).label).toBe("PLAYOFF CONTENDER");
    expect(resultTierFromProjectedWins(13).label).toBe("POWERHOUSE");
    expect(resultTierFromProjectedWins(15).label).toBe("ALL-TIME OFFENSE");
    expect(resultTierFromProjectedWins(16).label).toBe("ALL-TIME OFFENSE");
    expect(resultTierFromProjectedWins(17).label).toBe(PRODUCT_NAME);
  });

  it("treats only a 17-win projection as the jackpot season", () => {
    expect(isPerfectProjectedSeason(15)).toBe(false);
    expect(isPerfectProjectedSeason(16)).toBe(false);
    expect(isPerfectProjectedSeason(17)).toBe(true);
  });

  it("formats records and tiny probabilities without collapsing them to zero", () => {
    expect(formatProjectedRecord(14, 3)).toBe("14–3");
    expect(formatProjectedRecord(16, 1)).toBe("16–1");
    expect(formatProjectedRecord(17, 0)).toBe("17–0");
    expect(formatProbability(0.892)).toBe("89.2%");
    expect(formatProbability(0.158)).toBe("15.8%");
    expect(formatProbability(0.0048)).toBe("0.48%");
    expect(formatProbability(0.00004)).not.toBe("0%");
    expect(formatProbability(0)).toBe("0%");
  });
});
