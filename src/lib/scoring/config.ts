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
 * Below `tailExtension.startRating`, uses standard logistic curve.
 * Above that, a power-curve tail extends toward `maxWinProbability` so only
 * extraordinary offenses can project a perfect season
 * (requires p >= (seasonLength - 0.5) / seasonLength).
 *
 * Tail start sits at the 16-1 rounding boundary (~90.5) so the midrange
 * logistic is unchanged and 16-1 no longer begins at the old 88.5 tail.
 * Exponent is set so 17-0 begins near offense 92.25.
 */
export const WIN_PROJECTION_MODEL = {
  midpointRating: 62,
  steepness: 0.081,
  minWinProbability: 0.05,
  maxWinProbability: 0.99,
  seasonLength: REGULAR_SEASON_GAMES,
  tailExtension: {
    startRating: 90.5,
    endRating: 95,
    exponent: 0.292,
  },
} as const;

export const DATA_CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.4,
} as const;

/** Minimum peer sample before falling back to adjacent position pool. */
export const MIN_PEER_SAMPLE = 5;

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
  "Projected record assumes league-average offensive line, defense, special teams, coaching, and schedule. You are drafting the skill-position core.";
