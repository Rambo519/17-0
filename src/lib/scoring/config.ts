import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";
import { REGULAR_SEASON_GAMES } from "@/lib/football/season";

import type { MetricKey } from "./types";

/** Positive weights for each metric within a position scoring profile. */
export type PositionMetricWeights = Partial<Record<MetricKey, number>>;

/**
 * Position-specific metric weights. Negative factors (interceptions) use a
 * positive weight magnitude; direction is handled in percentile logic.
 */
export const POSITION_METRIC_WEIGHTS: Readonly<Record<NormalizedPosition, PositionMetricWeights>> = {
  QB: {
    passing_yards: 0.35,
    passing_touchdowns: 0.3,
    interceptions: 0.15,
    rushing_yards: 0.1,
    rushing_touchdowns: 0.1,
  },
  RB: {
    rushing_yards: 0.4,
    rushing_touchdowns: 0.25,
    receptions: 0.1,
    receiving_yards: 0.15,
    receiving_touchdowns: 0.1,
  },
  FB: {
    rushing_yards: 0.3,
    rushing_touchdowns: 0.2,
    receptions: 0.15,
    receiving_yards: 0.2,
    receiving_touchdowns: 0.15,
  },
  WR: {
    receiving_yards: 0.4,
    receiving_touchdowns: 0.3,
    receptions: 0.2,
    rushing_yards: 0.05,
    rushing_touchdowns: 0.05,
  },
  TE: {
    receiving_yards: 0.4,
    receiving_touchdowns: 0.3,
    receptions: 0.3,
  },
};

/** Metrics where lower raw values are better (invert peer percentile). */
export const LOWER_IS_BETTER_METRICS: ReadonlySet<MetricKey> = new Set(["interceptions"]);

/**
 * Maps composite peer percentile (0–100) to a calibrated player score (~0–100).
 * Keeps elite seasons below 100 so separation remains visible.
 */
export const SCORE_CALIBRATION = {
  minScore: 22,
  maxScore: 94,
  neutralPercentile: 50,
  neutralScore: 50,
} as const;

/**
 * Maps composite peer percentile (0–100) to a calibrated player score (~0–100).
 * Mid-tier stays interpretable; upper percentiles separate more strongly.
 */
export function calibratePercentileToScore(percentile: number): number {
  const { minScore, maxScore } = SCORE_CALIBRATION;
  const p = Math.max(0, Math.min(100, percentile)) / 100;

  if (p <= 0.5) {
    const t = p / 0.5;
    return minScore + t ** 1.15 * (50 - minScore);
  }

  const t = (p - 0.5) / 0.5;
  return 50 + t ** 0.78 * (maxScore - 50);
}

/** Slot weights for offense talent rating (WR1/WR2 evaluated as WR; RB1/RB2 as RB). */
export const LINEUP_SLOT_WEIGHTS: Readonly<Record<LineupSlot, number>> = {
  QB: 0.3,
  RB1: 0.115,
  RB2: 0.115,
  WR1: 0.16,
  WR2: 0.14,
  TE: 0.12,
};

/** Small lineup balance component layered on weighted talent. */
export const BALANCE_WEIGHT = 0.08;

export const BALANCE_ADJUSTMENT = {
  weakThreshold: 42,
  strongThreshold: 68,
  penaltyFactor: 0.22,
  maxPenalty: 7,
  bonusFactor: 0.14,
  maxBonus: 4,
} as const;

/**
 * Logistic win model: per-game win probability from offense rating.
 * Below `upperLadder.joinRating`, uses the standard logistic curve so
 * midrange records stay put. Above that, a piecewise-linear ladder in
 * probability space hits explicit 15-2 / 16-1 / 17-0 rating knots, then
 * continues to `maxWinProbability` at `endRating`.
 *
 * Knots are the minimum ratings that round to each record
 * (p = (wins - 0.5) / seasonLength).
 */
export const WIN_PROJECTION_MODEL = {
  midpointRating: 62,
  steepness: 0.081,
  minWinProbability: 0.05,
  maxWinProbability: 0.99,
  seasonLength: REGULAR_SEASON_GAMES,
  upperLadder: {
    joinRating: 80,
    fifteenTwoRating: 84,
    sixteenOneRating: 87,
    seventeenOhRating: 88.5,
    endRating: 95,
  },
} as const;

/**
 * Mixes expected wins toward a binomial 17-game season for the displayed record.
 *
 *   B ~ Binomial(seasonLength, p)
 *   wins = clamp(round(17p + k * (B - 17p)), 0, 17)
 *
 * k = 0 is deterministic round(17p). k = 1 is a full Binomial(17, p) season.
 * Locked at 0.35 after the 2026-09-03 measurement sweep: elite drafts trend
 * 17-0 with 16-1 common, BEST stays near five 17-0s in 50 games, and a
 * rating at the 17-0 knot does not fall to 14-3.
 *
 * Expected wins (17p) and perfect-season chance (p^17) do not use this k.
 */
export const SEASON_VARIANCE_K = 0.35;

export const DATA_CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.4,
} as const;

/** Minimum peer sample before falling back to adjacent position pool. */
export const MIN_PEER_SAMPLE = 5;

/**
 * 1982 and 1987 regular seasons were strike-shortened and include
 * replacement-player dilution. Percentile comparison pools the strike year
 * with the adjacent full seasons so a player's own totals stay intact while
 * the peer distribution is not an artifact of the lockout pool.
 */
export const STRIKE_PEER_WINDOW_SEASONS = [1982, 1987] as const;

export function peerComparisonSeasons(season: number): readonly number[] {
  if (season === 1982) return [1981, 1982, 1983];
  if (season === 1987) return [1986, 1987, 1988];
  return [season];
}

/**
 * Elite same-season rushing cannot collapse solely from low receiving.
 * Floor applies only when rushing-only percentile is already extreme, so
 * ordinary rushers are unchanged and receiving backs can still outscore the floor.
 */
export const RB_ELITE_RUSHING_FLOOR = {
  rushingOnlyThreshold: 98.5,
  maxPercentileDrop: 2,
} as const;

/**
 * A later season must beat the current best by more than this many points
 * after reliability adjustment before it replaces it. Inside the band, the
 * selector prefers higher reliability and then more games, so tiny score
 * jitter does not flip the engine-selected year.
 */
export const SCORING_SEASON_SWITCH_THRESHOLD = 0.5;

/** FB peer fallback order when FB-eligible sample is thin. */
export const FB_PEER_FALLBACK_POSITIONS: readonly NormalizedPosition[] = ["FB", "RB"];

/**
 * FB-slot metric weights (complementary role). Used only when the player is
 * drafted to the FB slot — dual RB/FB cards still use RB weights at RB.
 */
export const FB_SLOT_METRIC_WEIGHTS: PositionMetricWeights = {
  rushing_yards: 0.15,
  rushing_touchdowns: 0.15,
  receptions: 0.25,
  receiving_yards: 0.25,
  receiving_touchdowns: 0.2,
};

/** Feature-back seasons at FB are normalized against RB peers, not the thin FB pool. */
export const FB_FEATURE_BACK_RUSH_YARDS = 400;
export const FB_FEATURE_BACK_RUSH_ATTEMPTS = 100;

/**
 * After RB-peer normalization, feature-back seasons in the FB slot still look
 * like RB seasons. Blend toward 50 so the complementary slot cannot keep full
 * feature-back credit. 0.6 maps a 90th-percentile RB season to the 74th.
 */
export const FB_SLOT_FEATURE_PERCENTILE_BLEND = 0.6;

/**
 * Central model assumption for later UI copy. The six drafted skill players
 * are the only units the player chooses; remaining team quality is average.
 */
export const PROJECTED_RECORD_ASSUMPTION =
  "Final record assumes league-average offensive line, defense, special teams, coaching, and schedule. You are drafting the skill-position core.";
