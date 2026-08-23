import { LOWER_IS_BETTER_METRICS } from "./config";
import type { MetricKey } from "./types";

/**
 * Percentile rank of `value` within a peer distribution (0–100).
 * Uses the proportion of peers strictly below the value.
 */
export function percentileRank(
  value: number,
  peers: readonly number[],
  metric: MetricKey,
): number {
  if (peers.length === 0) return 50;
  if (peers.length === 1) {
    const only = peers[0];
    if (only == null) return 50;
    return value === only ? 50 : value > only ? 75 : 25;
  }

  let below = 0;
  let equal = 0;
  for (const peer of peers) {
    if (peer < value) below += 1;
    else if (peer === value) equal += 1;
  }

  const rank = (below + equal * 0.5) / peers.length;
  const percentile = rank * 100;

  if (LOWER_IS_BETTER_METRICS.has(metric)) {
    return 100 - percentile;
  }
  return percentile;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
