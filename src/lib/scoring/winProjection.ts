import { WIN_PROJECTION_MODEL } from "./config";
import { clamp } from "./percentile";
import type { WinProjection } from "./types";

function logistic(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function baseLogisticWinProbability(rating: number): number {
  const x =
    WIN_PROJECTION_MODEL.steepness *
    (rating - WIN_PROJECTION_MODEL.midpointRating);
  return logistic(x);
}

/**
 * Perfect-season chance from the engine win probability. Never round `p`
 * to a display percentage before raising it to season length — that is what
 * turned 0.96605^17 (55.6%) into a lower figure from 0.966^17.
 */
export function perfectSeasonProbabilityFromWinProbability(
  perGameWinProbability: number,
  seasonLength: number = WIN_PROJECTION_MODEL.seasonLength,
): number {
  return perGameWinProbability ** seasonLength;
}

/**
 * Maps offense rating to per-game win probability via a tunable logistic curve
 * with an elite-only tail extension above `tailExtension.startRating`.
 */
export function perGameWinProbabilityFromRating(rating: number): number {
  const model = WIN_PROJECTION_MODEL;
  const tail = model.tailExtension;

  if (rating <= tail.startRating) {
    return clamp(
      baseLogisticWinProbability(rating),
      model.minWinProbability,
      model.maxWinProbability,
    );
  }

  const baseAtTailStart = baseLogisticWinProbability(tail.startRating);
  const span = tail.endRating - tail.startRating;
  const progress = clamp((rating - tail.startRating) / span, 0, 1);
  const tailProgress = progress ** tail.exponent;
  const probability =
    baseAtTailStart + tailProgress * (model.maxWinProbability - baseAtTailStart);

  return clamp(probability, model.minWinProbability, model.maxWinProbability);
}

export function projectWinsFromRating(rating: number): WinProjection {
  const seasonLength = WIN_PROJECTION_MODEL.seasonLength;
  const perGameWinProbability = perGameWinProbabilityFromRating(rating);
  const expectedWins = seasonLength * perGameWinProbability;
  const projectedWins = clamp(Math.round(expectedWins), 0, seasonLength);
  const projectedLosses = seasonLength - projectedWins;

  return {
    expectedWins,
    projectedWins,
    projectedLosses,
    perGameWinProbability,
    perfectSeasonProbability: perfectSeasonProbabilityFromWinProbability(
      perGameWinProbability,
      seasonLength,
    ),
  };
}

/** Minimum per-game probability that rounds to `targetWins` expected wins. */
export function minimumPerGameProbabilityForProjectedWins(targetWins: number): number {
  const wins = clamp(Math.round(targetWins), 0, WIN_PROJECTION_MODEL.seasonLength);
  if (wins === 0) return 0;
  return (wins - 0.5) / WIN_PROJECTION_MODEL.seasonLength;
}

/**
 * Smallest offense rating whose rounded projected wins reach `targetWins`.
 * Uses binary search over the monotonic win curve.
 */
export function ratingThresholdForProjectedWins(targetWins: number): number {
  const wins = clamp(Math.round(targetWins), 0, WIN_PROJECTION_MODEL.seasonLength);
  if (wins === 0) return 0;

  let low = 0;
  let high = 100;
  while (high - low > 0.01) {
    const mid = (low + high) / 2;
    if (projectWinsFromRating(mid).projectedWins >= wins) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
}
