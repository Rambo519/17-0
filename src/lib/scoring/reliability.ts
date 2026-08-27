import type { NormalizedPosition } from "@/lib/football/positions";

import { SCORE_CALIBRATION } from "./config";
import { metricValueFromSeason } from "./metrics";
import type { PeerBaselineIndex } from "./peerBaselines";
import { clamp } from "./percentile";
import type { MetricKey, SeasonStatRecord } from "./types";

/** Volume metrics used to estimate sample reliability (not talent). */
const VOLUME_METRICS: Readonly<Record<NormalizedPosition, MetricKey[]>> = {
  QB: ["passing_yards", "passing_touchdowns"],
  RB: ["rushing_yards", "rushing_touchdowns", "receptions"],
  FB: ["rushing_yards", "receptions", "receiving_yards"],
  WR: ["receptions", "receiving_yards"],
  TE: ["receptions", "receiving_yards"],
};

export interface ReliabilityResult {
  /** 0–1 weight on the raw score vs cohort-neutral prior. */
  reliability: number;
  volumePercentile: number | null;
  gamesFactor: number;
}

function gamesParticipationFactor(games: number | null): number {
  if (games == null) return 0.35;
  if (games >= 14) return 1;
  if (games >= 10) return 0.78 + ((games - 10) / 4) * 0.22;
  if (games >= 6) return 0.42 + ((games - 6) / 4) * 0.36;
  if (games >= 3) return 0.18 + ((games - 3) / 3) * 0.24;
  if (games >= 1) return 0.06 + ((games - 1) / 2) * 0.12;
  return 0.05;
}

/**
 * When games played is missing (common in older stat sources), infer participation
 * from cohort-relative volume — not modern yardage standards.
 */
function inferredGamesFactorFromVolume(volumePercentile: number | null): number {
  if (volumePercentile == null) return 0.35;
  const volumeNorm = volumePercentile / 100;
  if (volumeNorm >= 0.7) return 0.88 + 0.12 * volumeNorm ** 0.45;
  if (volumeNorm >= 0.4) return 0.42 + ((volumeNorm - 0.4) / 0.3) * 0.46;
  return 0.2 + volumeNorm * 0.55;
}

function effectiveGamesFactor(
  stat: SeasonStatRecord,
  volumePercentile: number | null,
): number {
  if (stat.games != null) return gamesParticipationFactor(stat.games);
  if (stat.gamesStarted != null) return gamesParticipationFactor(stat.gamesStarted);
  return inferredGamesFactorFromVolume(volumePercentile);
}

function volumePercentileForSeason(
  stat: SeasonStatRecord,
  position: NormalizedPosition,
  baselines: PeerBaselineIndex,
  peerPositionForMetric?: (metric: MetricKey) => NormalizedPosition,
): number | null {
  const keys = VOLUME_METRICS[position];
  let weightSum = 0;
  let percentileSum = 0;

  for (const key of keys) {
    const value = metricValueFromSeason(stat, key);
    if (value == null) continue;
    const peerPosition = peerPositionForMetric?.(key) ?? position;
    const peers = baselines.peerValues(stat.season, peerPosition, key);
    if (peers.length === 0) continue;
    weightSum += 1;
    percentileSum += baselines.percentileAgainst(stat.season, peerPosition, key, value);
  }

  if (stat.rushingAttempts != null && (position === "RB" || position === "FB")) {
    const peerPosition = peerPositionForMetric?.("rushing_yards") ?? position;
    const peers = baselines.peerValues(stat.season, peerPosition, "rushing_yards");
    if (peers.length > 0) {
      const rushYardsProxy = stat.rushingAttempts * 4;
      weightSum += 1;
      percentileSum += baselines.percentileAgainst(
        stat.season,
        peerPosition,
        "rushing_yards",
        rushYardsProxy,
      );
    }
  }

  if (weightSum === 0) return null;
  return percentileSum / weightSum;
}

/**
 * Cohort-relative reliability: low-volume seasons shrink toward neutral.
 * Does not impose modern volume standards on older eras.
 */
export function computeSeasonReliability(
  stat: SeasonStatRecord,
  position: NormalizedPosition,
  baselines: PeerBaselineIndex,
  options: {
    peerPositionForMetric?: (metric: MetricKey) => NormalizedPosition;
  } = {},
): ReliabilityResult {
  const volumePercentile = volumePercentileForSeason(stat, position, baselines, options.peerPositionForMetric);
  const gamesFactor = effectiveGamesFactor(stat, volumePercentile);

  const volumeNorm =
    volumePercentile != null ? volumePercentile / 100 : gamesFactor * 0.55;

  const volumeFactor = 0.18 + 0.82 * volumeNorm ** 0.72;
  let reliability = clamp(gamesFactor * volumeFactor, 0.12, 1);

  // Full-season samples with cohort-meaningful volume earn near-full confidence.
  if (gamesFactor >= 0.88 && volumePercentile != null && volumePercentile >= 45) {
    const fullSeasonFloor = 0.92 + 0.08 * volumeNorm ** 0.35;
    reliability = Math.max(reliability, clamp(fullSeasonFloor, 0.12, 1));
  }

  return {
    reliability,
    volumePercentile,
    gamesFactor,
  };
}

function shrinkageWeight(reliability: number, stat: SeasonStatRecord): number {
  const knownGames = stat.games ?? stat.gamesStarted;
  if (knownGames != null && knownGames < 6) {
    return reliability ** 1.45;
  }
  return reliability;
}

export function applyReliabilityShrinkage(
  rawScore: number,
  reliability: number,
  usedNeutralFallback: boolean,
  stat?: SeasonStatRecord,
): number {
  const neutral = SCORE_CALIBRATION.neutralScore;
  if (usedNeutralFallback) {
    return Math.min(neutral + 2, neutral + reliability * 2);
  }
  const weight = stat ? shrinkageWeight(reliability, stat) : reliability;
  const shrunk = neutral + weight * (rawScore - neutral);
  return clamp(shrunk, SCORE_CALIBRATION.minScore, SCORE_CALIBRATION.maxScore);
}
