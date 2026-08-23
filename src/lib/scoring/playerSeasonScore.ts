import {
  calibratePercentileToScore,
  DATA_CONFIDENCE_THRESHOLDS,
  POSITION_METRIC_WEIGHTS,
  SCORE_CALIBRATION,
} from "./config";
import { metricValueFromSeason } from "./metrics";
import type { PeerBaselineIndex } from "./peerBaselines";
import type { DataConfidence, MetricEvaluation, MetricKey } from "./types";
import type { NormalizedPosition } from "@/lib/football/positions";
import type { SeasonStatRecord } from "./types";

export interface PlayerSeasonScoreResult {
  productionScore: number;
  percentileRank: number;
  dataConfidence: DataConfidence;
  metrics: MetricEvaluation[];
  usedNeutralFallback: boolean;
}

function confidenceFromCoverage(coverageRatio: number): DataConfidence {
  if (coverageRatio >= DATA_CONFIDENCE_THRESHOLDS.high) return "HIGH";
  if (coverageRatio >= DATA_CONFIDENCE_THRESHOLDS.medium) return "MEDIUM";
  return "LOW";
}

function neutralFallback(position: NormalizedPosition): PlayerSeasonScoreResult {
  const weights = POSITION_METRIC_WEIGHTS[position];
  const metrics: MetricEvaluation[] = Object.entries(weights).map(([key, weight]) => ({
    key: key as MetricKey,
    rawValue: null,
    percentile: null,
    weight,
  }));

  return {
    productionScore: SCORE_CALIBRATION.neutralScore,
    percentileRank: SCORE_CALIBRATION.neutralPercentile,
    dataConfidence: "LOW",
    metrics,
    usedNeutralFallback: true,
  };
}

/**
 * Score a single player season against same-season position peers.
 */
export function scorePlayerSeason(
  stat: SeasonStatRecord,
  scoringPosition: NormalizedPosition,
  baselines: PeerBaselineIndex,
): PlayerSeasonScoreResult {
  const weights = POSITION_METRIC_WEIGHTS[scoringPosition];
  const metricEntries = Object.entries(weights) as [MetricKey, number][];

  let availableWeight = 0;
  let weightedPercentileSum = 0;
  const metrics: MetricEvaluation[] = [];

  for (const [key, baseWeight] of metricEntries) {
    const rawValue = metricValueFromSeason(stat, key);
    if (rawValue == null) {
      metrics.push({ key, rawValue: null, percentile: null, weight: 0 });
      continue;
    }

    const percentile = baselines.percentile(stat.season, scoringPosition, key, rawValue);
    availableWeight += baseWeight;
    weightedPercentileSum += baseWeight * percentile;
    metrics.push({ key, rawValue, percentile, weight: 0 });
  }

  if (availableWeight === 0) {
    return neutralFallback(scoringPosition);
  }

  const compositePercentile = weightedPercentileSum / availableWeight;
  const productionScore = calibratePercentileToScore(compositePercentile);
  const coverageRatio = availableWeight / metricEntries.reduce((sum, [, w]) => sum + w, 0);

  for (const metric of metrics) {
    if (metric.rawValue != null) {
      const baseWeight = weights[metric.key] ?? 0;
      metric.weight = baseWeight / availableWeight;
    }
  }

  return {
    productionScore,
    percentileRank: compositePercentile,
    dataConfidence: confidenceFromCoverage(coverageRatio),
    metrics,
    usedNeutralFallback: false,
  };
}
