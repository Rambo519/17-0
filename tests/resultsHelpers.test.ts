import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "@/lib/brand";
import {
  formatPerfectSeasonChance,
  formatProbability,
  formatProjectedRecord,
  formatWinProbability,
} from "@/lib/results/format";
import { isPerfectProjectedSeason, resultTierFromProjectedWins } from "@/lib/results/tiers";
import { perfectSeasonProbabilityFromWinProbability } from "@/lib/scoring/winProjection";

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

describe("17-0 chance uses full-precision win probability", () => {
  /** Engine per-game p for the 92.4 offense example before/independent of display rounding. */
  const fullPrecisionWinProbability = 0.9660465823824238;

  it("drives perfect-season chance from full-precision p, not the 96.6% display", () => {
    const perfect = perfectSeasonProbabilityFromWinProbability(fullPrecisionWinProbability);
    expect(perfect * 100).toBeCloseTo(55.6, 1);
    expect(formatPerfectSeasonChance(perfect)).toBe("55.6%");
    expect(formatPerfectSeasonChance(perfect)).not.toBe("55.3%");
    expect(formatWinProbability(fullPrecisionWinProbability)).toBe("96.6%");

    const fromDisplayedPercentage = perfectSeasonProbabilityFromWinProbability(0.966);
    expect(fromDisplayedPercentage).toBeLessThan(perfect);
  });

  it("treats rounded win probability as presentation only", () => {
    expect(formatWinProbability(fullPrecisionWinProbability)).toBe("96.6%");
    expect(formatWinProbability(fullPrecisionWinProbability)).not.toBe(
      formatPerfectSeasonChance(
        perfectSeasonProbabilityFromWinProbability(fullPrecisionWinProbability),
      ),
    );
  });
});
