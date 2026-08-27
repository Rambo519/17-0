import {
  FB_FEATURE_BACK_RUSH_ATTEMPTS,
  FB_FEATURE_BACK_RUSH_YARDS,
  FB_SLOT_FEATURE_PERCENTILE_BLEND,
  FB_SLOT_METRIC_WEIGHTS,
} from "./config";
import type { MetricKey, SeasonStatRecord } from "./types";
import type { NormalizedPosition } from "@/lib/football/positions";

export { FB_SLOT_METRIC_WEIGHTS };

/** Feature RB usage that must not explode against the complementary FB cohort. */
export function isFeatureBackSeason(stat: SeasonStatRecord): boolean {
  return (
    (stat.rushingYards ?? 0) >= FB_FEATURE_BACK_RUSH_YARDS ||
    (stat.rushingAttempts ?? 0) >= FB_FEATURE_BACK_RUSH_ATTEMPTS
  );
}

export function carriesRbEligibility(
  seasonPositions: readonly NormalizedPosition[],
  cardPositions: readonly NormalizedPosition[],
): boolean {
  return seasonPositions.includes("RB") || cardPositions.includes("RB");
}

/**
 * Peer group for one metric when the player occupies the FB slot.
 *
 * Feature-back seasons (high rushing volume) are compared to RBs for every
 * metric so 900-yard duals are not 99th-percentile fullbacks.
 * Dual RB/FB seasons that are not feature backs still use RB peers for
 * rushing and FB peers for receiving (complementary checkdowns).
 * FB-only seasons use FB peers throughout.
 */
export function fbSlotPeerPosition(
  metric: MetricKey,
  stat: SeasonStatRecord,
  cardPositions: readonly NormalizedPosition[] = stat.positions,
): NormalizedPosition {
  const dualRb = carriesRbEligibility(stat.positions, cardPositions);
  const feature = isFeatureBackSeason(stat);
  const rushing = metric === "rushing_yards" || metric === "rushing_touchdowns";

  if (feature) return "RB";
  if (rushing && dualRb) return "RB";
  return "FB";
}

/** Compress feature-back volume so the FB slot cannot keep a full RB score. */
export function blendFeatureBackPercentile(compositePercentile: number): number {
  return 50 + (compositePercentile - 50) * FB_SLOT_FEATURE_PERCENTILE_BLEND;
}
