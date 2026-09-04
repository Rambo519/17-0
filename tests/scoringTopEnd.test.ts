import { describe, expect, it } from "vitest";

import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { WIN_PROJECTION_MODEL } from "@/lib/scoring/config";
import {
  expectedRecordWinsFromRating,
  minimumPerGameProbabilityForProjectedWins,
  perGameWinProbabilityFromRating,
  perfectSeasonProbabilityFromWinProbability,
  projectWinsFromRating,
  ratingThresholdForProjectedWins,
} from "@/lib/scoring/winProjection";

describe("scoring top-end win projection", () => {
  it("allows 17-0 projection at an extreme offense rating", () => {
    const projection = projectWinsFromRating(93);
    expect(projection.perGameWinProbability).toBeGreaterThanOrEqual(
      minimumPerGameProbabilityForProjectedWins(REGULAR_SEASON_GAMES),
    );
    expect(expectedRecordWinsFromRating(93)).toBe(17);
    expect(projection.projectedLosses).toBe(0);
  });

  it("requires an extreme rating for 17-0 projection", () => {
    const threshold = ratingThresholdForProjectedWins(REGULAR_SEASON_GAMES);
    expect(threshold).toBeGreaterThan(88);
    expect(expectedRecordWinsFromRating(threshold - 1)).toBeLessThan(17);
    expect(expectedRecordWinsFromRating(threshold)).toBe(17);
  });

  it("keeps elite but non-extreme teams below 17 projected wins", () => {
    for (const rating of [82, 85, 88, 88.4]) {
      expect(expectedRecordWinsFromRating(rating)).toBeLessThan(17);
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

  it("maintains perfect-season probability under the k-blend season model", () => {
    for (const rating of [62, 82, 90, 93, 96]) {
      const projection = projectWinsFromRating(rating);
      expect(projection.perfectSeasonProbability).toBeCloseTo(
        perfectSeasonProbabilityFromWinProbability(projection.perGameWinProbability),
        10,
      );
    }
  });

  it("does not change mid-tier probabilities below the tail start", () => {
    const baseline = 1 / (1 + Math.exp(-WIN_PROJECTION_MODEL.steepness * (73 - 62)));
    expect(perGameWinProbabilityFromRating(73)).toBeCloseTo(baseline, 10);
  });

  it("starts 16-1 near offense 87 and 17-0 near 88.5", () => {
    const sixteen = ratingThresholdForProjectedWins(16);
    const seventeen = ratingThresholdForProjectedWins(REGULAR_SEASON_GAMES);
    expect(sixteen).toBeGreaterThanOrEqual(86.9);
    expect(sixteen).toBeLessThanOrEqual(87.2);
    expect(seventeen).toBeGreaterThan(88.4);
    expect(seventeen).toBeLessThan(88.6);
    expect(expectedRecordWinsFromRating(83.9)).toBe(14);
    expect(expectedRecordWinsFromRating(84)).toBe(15);
    expect(expectedRecordWinsFromRating(86.9)).toBe(15);
    expect(expectedRecordWinsFromRating(87)).toBe(16);
    expect(expectedRecordWinsFromRating(88.49)).toBe(16);
    expect(expectedRecordWinsFromRating(88.5)).toBe(17);
    expect(expectedRecordWinsFromRating(100)).toBe(17);
    expect(perGameWinProbabilityFromRating(100)).toBe(
      WIN_PROJECTION_MODEL.maxWinProbability,
    );
  });

  it("computes 17-0 chance from full-precision p, not the displayed percentage", () => {
    const projection = projectWinsFromRating(92.4);
    expect(projection.perfectSeasonProbability).toBeCloseTo(
      perfectSeasonProbabilityFromWinProbability(projection.perGameWinProbability),
      12,
    );
    const displayRoundedP = Number((projection.perGameWinProbability * 100).toFixed(1)) / 100;
    expect(projection.perfectSeasonProbability).not.toBeCloseTo(
      perfectSeasonProbabilityFromWinProbability(displayRoundedP),
      5,
    );
  });
});
