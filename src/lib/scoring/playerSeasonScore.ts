import {
  calibratePercentileToScore,
  DATA_CONFIDENCE_THRESHOLDS,
  FB_SLOT_METRIC_WEIGHTS,
  POSITION_METRIC_WEIGHTS,
  SCORE_CALIBRATION,
} from "./config";
import { blendFeatureBackPercentile, fbSlotPeerPosition, isFeatureBackSeason } from "./fbSlot";
import { metricValueFromSeason } from "./metrics";
import type { PeerBaselineIndex } from "./peerBaselines";
import {
  applyReliabilityShrinkage,
  computeSeasonReliability,
} from "./reliability";
import type { DataConfidence, MetricEvaluation, MetricKey } from "./types";
import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";
import type { SeasonStatRecord } from "./types";

export interface PlayerSeasonScoreResult {
  rawProductionScore: number;
  adjustedProductionScore: number;
  productionScore: number;
  percentileRank: number;
  reliability: number;
  volumePercentile: number | null;
  gamesFactor: number;
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

  const reliability = 0.15;
  const adjusted = applyReliabilityShrinkage(
    SCORE_CALIBRATION.neutralScore,
    reliability,
    true,
  );

  return {
    rawProductionScore: SCORE_CALIBRATION.neutralScore,
    adjustedProductionScore: adjusted,
    productionScore: adjusted,
    percentileRank: SCORE_CALIBRATION.neutralPercentile,
    reliability,
    volumePercentile: null,
    gamesFactor: 0.45,
    dataConfidence: "LOW",
    metrics,
    usedNeutralFallback: true,
  };
}

export interface ScorePlayerSeasonOptions {
  lineupSlot?: LineupSlot;
  cardPositions?: readonly NormalizedPosition[];
}

function isFbSlot(scoringPosition: NormalizedPosition, slot: LineupSlot | undefined): boolean {
  return slot === "FB" || (slot == null && scoringPosition === "FB");
}

/**
 * Score a single player season against same-season position peers.
 * FB-slot evaluation is complementary and slot-aware; RB evaluation of the
 * same dual-eligible card is unchanged.
 */
export function scorePlayerSeason(
  stat: SeasonStatRecord,
  scoringPosition: NormalizedPosition,
  baselines: PeerBaselineIndex,
  options: ScorePlayerSeasonOptions = {},
): PlayerSeasonScoreResult {
  const fbSlot = isFbSlot(scoringPosition, options.lineupSlot);
  const cardPositions = options.cardPositions ?? stat.positions;
  const weights = fbSlot ? FB_SLOT_METRIC_WEIGHTS : POSITION_METRIC_WEIGHTS[scoringPosition];
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

    const peerPosition = fbSlot
      ? fbSlotPeerPosition(key, stat, cardPositions)
      : scoringPosition;
    const percentile = baselines.percentileAgainst(stat.season, peerPosition, key, rawValue);
    availableWeight += baseWeight;
    weightedPercentileSum += baseWeight * percentile;
    metrics.push({ key, rawValue, percentile, weight: 0 });
  }

  if (availableWeight === 0) {
    return neutralFallback(scoringPosition);
  }

  let compositePercentile = weightedPercentileSum / availableWeight;
  if (fbSlot && isFeatureBackSeason(stat)) {
    compositePercentile = blendFeatureBackPercentile(compositePercentile);
  }
  const rawProductionScore = calibratePercentileToScore(compositePercentile);
  const coverageRatio = availableWeight / metricEntries.reduce((sum, [, w]) => sum + w, 0);

  for (const metric of metrics) {
    if (metric.rawValue != null) {
      const baseWeight = weights[metric.key] ?? 0;
      metric.weight = baseWeight / availableWeight;
    }
  }

  const reliabilityResult = computeSeasonReliability(stat, scoringPosition, baselines, {
    peerPositionForMetric: fbSlot
      ? (metric) => fbSlotPeerPosition(metric, stat, cardPositions)
      : undefined,
  });
  const adjustedProductionScore = applyReliabilityShrinkage(
    rawProductionScore,
    reliabilityResult.reliability,
    false,
    stat,
  );

  return {
    rawProductionScore,
    adjustedProductionScore,
    productionScore: adjustedProductionScore,
    percentileRank: compositePercentile,
    reliability: reliabilityResult.reliability,
    volumePercentile: reliabilityResult.volumePercentile,
    gamesFactor: reliabilityResult.gamesFactor,
    dataConfidence: confidenceFromCoverage(coverageRatio),
    metrics,
    usedNeutralFallback: false,
  };
}
