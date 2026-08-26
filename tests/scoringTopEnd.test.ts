import { describe, expect, it } from "vitest";

import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { WIN_PROJECTION_MODEL } from "@/lib/scoring/config";
import {
  minimumPerGameProbabilityForProjectedWins,
  perGameWinProbabilityFromRating,
  projectWinsFromRating,
  ratingThresholdForProjectedWins,
} from "@/lib/scoring/winProjection";

describe("scoring top-end win projection", () => {
  it("allows 17-0 projection at an extreme offense rating", () => {
    const projection = projectWinsFromRating(93);
    expect(projection.perGameWinProbability).toBeGreaterThanOrEqual(
      minimumPerGameProbabilityForProjectedWins(REGULAR_SEASON_GAMES),
    );
    expect(projection.projectedWins).toBe(17);
    expect(projection.projectedLosses).toBe(0);
  });

  it("requires an extreme rating for 17-0 projection", () => {
    const threshold = ratingThresholdForProjectedWins(REGULAR_SEASON_GAMES);
    expect(threshold).toBeGreaterThan(90);
    expect(projectWinsFromRating(threshold - 1).projectedWins).toBeLessThan(17);
    expect(projectWinsFromRating(threshold).projectedWins).toBe(17);
  });

  it("keeps elite but non-extreme teams below 17 projected wins", () => {
    for (const rating of [82, 85, 88, 90]) {
      expect(projectWinsFromRating(rating).projectedWins).toBeLessThan(17);
    }
  });

  it("keeps expected wins monotonic with offense rating", () => {
    const ratings = [45, 55, 62, 73, 82, 85, 90, 93, 96];
    const wins = ratings.map((rating) => projectWinsFromRating(rating).expectedWins);
    for (let i = 1; i < wins.length; i += 1) {
      expect(wins[i]).toBeGreaterThan(wins[i - 1]!);
    }
  });

  it("keeps per-game probability bounded", () => {
    for (const rating of [10, 45, 62, 82, 90, 96, 100]) {
      const probability = perGameWinProbabilityFromRating(rating);
      expect(probability).toBeGreaterThanOrEqual(WIN_PROJECTION_MODEL.minWinProbability);
      expect(probability).toBeLessThanOrEqual(WIN_PROJECTION_MODEL.maxWinProbability);
    }
  });

  it("maintains perfect-season probability as p^seasonLength", () => {
    for (const rating of [62, 82, 90, 93, 96]) {
      const projection = projectWinsFromRating(rating);
      const expected =
        projection.perGameWinProbability ** WIN_PROJECTION_MODEL.seasonLength;
      expect(projection.perfectSeasonProbability).toBeCloseTo(expected, 10);
    }
  });

  it("does not change mid-tier probabilities below the tail start", () => {
    const baseline = 1 / (1 + Math.exp(-WIN_PROJECTION_MODEL.steepness * (73 - 62)));
    expect(perGameWinProbabilityFromRating(73)).toBeCloseTo(baseline, 10);
  });
});
