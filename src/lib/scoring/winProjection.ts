import { SEASON_VARIANCE_K, WIN_PROJECTION_MODEL } from "./config";
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

/** FNV-1a 32-bit. Stable across runtimes; not a cryptographic hash. */
function hashStringToUint32(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function binomialPmf(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  let logC = 0;
  for (let i = 1; i <= k; i += 1) {
    logC += Math.log(n - k + i) - Math.log(i);
  }
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

/** Inverse-CDF sample of Binomial(n, p) from one deterministic uniform. */
function sampleBinomial(n: number, p: number, uniform: number): number {
  if (p <= 0) return 0;
  if (p >= 1) return n;
  const u = clamp(uniform, 0, 1 - Number.EPSILON);
  let cumulative = 0;
  for (let wins = 0; wins < n; wins += 1) {
    cumulative += binomialPmf(n, wins, p);
    if (u < cumulative) return wins;
  }
  return n;
}

/**
 * Displayed wins from a binomial season blended toward expected wins.
 * Seeded from the game session id so refresh cannot reroll.
 */
export function simulateSeasonWins(
  perGameWinProbability: number,
  seasonSeed: string,
  k: number = SEASON_VARIANCE_K,
  seasonLength: number = WIN_PROJECTION_MODEL.seasonLength,
): number {
  const p = clamp(perGameWinProbability, 0, 1);
  const expectedWins = seasonLength * p;
  const rng = mulberry32(hashStringToUint32(`17-0:season:${seasonSeed}`));
  const binomialWins = sampleBinomial(seasonLength, p, rng());
  return clamp(Math.round(expectedWins + k * (binomialWins - expectedWins)), 0, seasonLength);
}

/**
 * C6 expected record: round(seasonLength × p), independent of season variance.
 * The 15-2 / 16-1 / 17-0 rating knots are defined on this quantity.
 */
export function expectedRecordWinsFromRating(rating: number): number {
  const seasonLength = WIN_PROJECTION_MODEL.seasonLength;
  const expectedWins = seasonLength * perGameWinProbabilityFromRating(rating);
  return clamp(Math.round(expectedWins), 0, seasonLength);
}

/**
 * Maps offense rating to expected wins, lineup 17-0 chance, and a displayed record.
 *
 * Pass `seasonSeed` (the game session id) to draw the k-blend binomial season.
 * Omit it for ladder math and audits, which keep round(17p).
 */
export function projectWinsFromRating(rating: number, seasonSeed?: string): WinProjection {
  const seasonLength = WIN_PROJECTION_MODEL.seasonLength;
  const perGameWinProbability = perGameWinProbabilityFromRating(rating);
  const expectedWins = seasonLength * perGameWinProbability;
  const projectedWins =
    seasonSeed == null
      ? clamp(Math.round(expectedWins), 0, seasonLength)
      : simulateSeasonWins(perGameWinProbability, seasonSeed);
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
 * Smallest offense rating whose rounded expected wins reach `targetWins`.
 * Uses binary search over the C6 win curve, not the stochastic displayed record.
 */
export function ratingThresholdForProjectedWins(targetWins: number): number {
  const wins = clamp(Math.round(targetWins), 0, WIN_PROJECTION_MODEL.seasonLength);
  if (wins === 0) return 0;

  let low = 0;
  let high = 100;
  while (high - low > 0.01) {
    const mid = (low + high) / 2;
    if (expectedRecordWinsFromRating(mid) >= wins) {
      high = mid;
    } else {
      low = mid;
    }
  }
  return high;
}
