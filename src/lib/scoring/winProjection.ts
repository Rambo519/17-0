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
 * Maps offense rating to per-game win probability via a logistic curve
 * below `upperLadder.joinRating`, then a monotonic piecewise-linear ladder
 * through the 15-2 / 16-1 / 17-0 knots.
 */
export function perGameWinProbabilityFromRating(rating: number): number {
  const model = WIN_PROJECTION_MODEL;
  const ladder = model.upperLadder;

  if (rating <= ladder.joinRating) {
    return clamp(
      baseLogisticWinProbability(rating),
      model.minWinProbability,
      model.maxWinProbability,
    );
  }

  const knots = [
    { rating: ladder.joinRating, p: baseLogisticWinProbability(ladder.joinRating) },
    { rating: ladder.fifteenTwoRating, p: minimumPerGameProbabilityForProjectedWins(15) },
    { rating: ladder.sixteenOneRating, p: minimumPerGameProbabilityForProjectedWins(16) },
    { rating: ladder.seventeenOhRating, p: minimumPerGameProbabilityForProjectedWins(17) },
    { rating: ladder.endRating, p: model.maxWinProbability },
  ];

  return clamp(interpolateProbability(rating, knots), model.minWinProbability, model.maxWinProbability);
}

function interpolateProbability(
  rating: number,
  knots: ReadonlyArray<{ rating: number; p: number }>,
): number {
  const first = knots[0];
  const last = knots[knots.length - 1];
  if (!first || !last) return 0;
  if (rating <= first.rating) return first.p;
  if (rating >= last.rating) return last.p;
  for (let index = 1; index < knots.length; index += 1) {
    const right = knots[index]!;
    const left = knots[index - 1]!;
    if (rating <= right.rating) {
      const span = right.rating - left.rating;
      const t = span === 0 ? 1 : (rating - left.rating) / span;
      return left.p + t * (right.p - left.p);
    }
  }
  return last.p;
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
