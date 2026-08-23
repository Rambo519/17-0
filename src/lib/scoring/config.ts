import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

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

/** Slot weights for offense talent rating (WR1/WR2 evaluated as WR, not slot-inflated). */
export const LINEUP_SLOT_WEIGHTS: Readonly<Record<LineupSlot, number>> = {
  QB: 0.3,
  RB: 0.15,
  FB: 0.08,
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
 * Tunable constants — not sacred.
 */
export const WIN_PROJECTION_MODEL = {
  midpointRating: 62,
  steepness: 0.081,
  minWinProbability: 0.05,
  maxWinProbability: 0.95,
  seasonLength: 16,
} as const;

export const DATA_CONFIDENCE_THRESHOLDS = {
  high: 0.7,
  medium: 0.4,
} as const;

/** Minimum peer sample before falling back to adjacent position pool. */
export const MIN_PEER_SAMPLE = 5;

/** FB peer fallback order when FB-eligible sample is thin. */
export const FB_PEER_FALLBACK_POSITIONS: readonly NormalizedPosition[] = ["FB", "RB"];
