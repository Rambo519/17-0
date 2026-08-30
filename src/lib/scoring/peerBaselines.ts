import type { NormalizedPosition } from "@/lib/football/positions";

import {
  FB_PEER_FALLBACK_POSITIONS,
  MIN_PEER_SAMPLE,
  POSITION_METRIC_WEIGHTS,
} from "./config";
import { metricValueFromSeason } from "./metrics";
import { percentileRank } from "./percentile";
import type { MetricKey, SeasonStatRecord } from "./types";

type SeasonPositionKey = `${number}:${NormalizedPosition}`;

function seasonPositionKey(season: number, position: NormalizedPosition): SeasonPositionKey {
  return `${season}:${position}`;
}

/**
 * Peer distributions keyed by NFL season and normalized position group.
 * Built once from the full player-season corpus for percentile normalization.
 */
export class PeerBaselineIndex {
  private readonly valuesBySeasonPositionMetric: Map<string, number[]>;

  constructor(seasonStats: readonly SeasonStatRecord[]) {
    this.valuesBySeasonPositionMetric = new Map();
    for (const stat of seasonStats) {
      for (const position of stat.positions) {
        this.addSeasonToPeerGroups(stat, position);
      }
    }
  }

  /** Restore an index from buckets produced by `buildPeerBaselineIndex`. */
  static fromSerializedBuckets(
    buckets: Readonly<Record<string, readonly number[]>>,
  ): PeerBaselineIndex {
    const index = new PeerBaselineIndex([]);
    index.valuesBySeasonPositionMetric.clear();
    for (const key of Object.keys(buckets).sort()) {
      const values = buckets[key];
      if (!values) continue;
      index.valuesBySeasonPositionMetric.set(key, values.slice());
    }
    return index;
  }

  toSerializedBuckets(): Record<string, number[]> {
    const buckets: Record<string, number[]> = {};
    for (const key of [...this.valuesBySeasonPositionMetric.keys()].sort()) {
      buckets[key] = (this.valuesBySeasonPositionMetric.get(key) ?? []).slice();
    }
    return buckets;
  }

  private addSeasonToPeerGroups(stat: SeasonStatRecord, position: NormalizedPosition): void {
    const weights = POSITION_METRIC_WEIGHTS[position];
    for (const metric of Object.keys(weights) as MetricKey[]) {
      const value = metricValueFromSeason(stat, metric);
      if (value == null) continue;
      const key = `${seasonPositionKey(stat.season, position)}:${metric}`;
      const bucket = this.valuesBySeasonPositionMetric.get(key) ?? [];
      bucket.push(value);
      this.valuesBySeasonPositionMetric.set(key, bucket);
    }
  }

  peerValues(
    season: number,
    position: NormalizedPosition,
    metric: MetricKey,
  ): readonly number[] {
    const positions =
      position === "FB" ? this.resolveFbPeerPositions(season, metric) : [position];

    const merged: number[] = [];
    for (const peerPosition of positions) {
      const key = `${seasonPositionKey(season, peerPosition)}:${metric}`;
      const values = this.valuesBySeasonPositionMetric.get(key);
      if (values) merged.push(...values);
    }
    return merged;
  }

  percentile(
    season: number,
    position: NormalizedPosition,
    metric: MetricKey,
    value: number,
  ): number {
    const peers = this.peerValues(season, position, metric);
    return percentileRank(value, peers, metric);
  }

  /** Percentile against an explicit peer position. RB never uses the FB fallback. */
  percentileAgainst(
    season: number,
    peerPosition: NormalizedPosition,
    metric: MetricKey,
    value: number,
  ): number {
    if (peerPosition === "FB") {
      return this.percentile(season, "FB", metric, value);
    }
    const key = `${seasonPositionKey(season, peerPosition)}:${metric}`;
    const exact = this.valuesBySeasonPositionMetric.get(key) ?? [];
    const peers = exact.length > 0 ? exact : this.peerValues(season, peerPosition, metric);
    return percentileRank(value, peers, metric);
  }

  private resolveFbPeerPositions(season: number, metric: MetricKey): NormalizedPosition[] {
    for (const position of FB_PEER_FALLBACK_POSITIONS) {
      const key = `${seasonPositionKey(season, position)}:${metric}`;
      const values = this.valuesBySeasonPositionMetric.get(key);
      if (values && values.length >= MIN_PEER_SAMPLE) {
        return [position];
      }
    }
    return [...FB_PEER_FALLBACK_POSITIONS];
  }
}

export function buildPeerBaselineIndex(seasonStats: readonly SeasonStatRecord[]): PeerBaselineIndex {
  return new PeerBaselineIndex(seasonStats);
}

export function serializePeerBaselineIndex(index: PeerBaselineIndex): Record<string, number[]> {
  return index.toSerializedBuckets();
}

export function peerBaselineIndexFromSerialized(
  buckets: Readonly<Record<string, readonly number[]>>,
): PeerBaselineIndex {
  return PeerBaselineIndex.fromSerializedBuckets(buckets);
}
