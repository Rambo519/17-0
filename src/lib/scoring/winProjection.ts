import { WIN_PROJECTION_MODEL } from "./config";
import { clamp } from "./percentile";
import type { WinProjection } from "./types";

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

/**
 * Maps offense rating to per-game win probability via a tunable logistic curve.
 * Probability is a game-model estimate, not real-world certainty.
 */
export function perGameWinProbabilityFromRating(rating: number): number {
  const x =
    WIN_PROJECTION_MODEL.steepness *
    (rating - WIN_PROJECTION_MODEL.midpointRating);
  return clamp(
    logistic(x),
    WIN_PROJECTION_MODEL.minWinProbability,
    WIN_PROJECTION_MODEL.maxWinProbability,
  );
}

export function projectWinsFromRating(rating: number): WinProjection {
  const perGameWinProbability = perGameWinProbabilityFromRating(rating);
  const expectedWins = WIN_PROJECTION_MODEL.seasonLength * perGameWinProbability;
  const projectedWins = clamp(
    Math.round(expectedWins),
    0,
    WIN_PROJECTION_MODEL.seasonLength,
  );
  const projectedLosses = WIN_PROJECTION_MODEL.seasonLength - projectedWins;

  return {
    expectedWins,
    projectedWins,
    projectedLosses,
    perGameWinProbability,
    perfectSeasonProbability: perGameWinProbability ** WIN_PROJECTION_MODEL.seasonLength,
  };
}
