import { PLAYABLE_ERA_LABELS } from "@/lib/football/eras";

import {
  peerBaselineIndexFromSerialized,
  type PeerBaselineIndex,
  serializePeerBaselineIndex,
} from "./peerBaselines";

export type { PeerBaselineIndex };

/** Bump when the snapshot JSON shape changes. */
export const PEER_BASELINE_SNAPSHOT_VERSION = 1;

export interface PeerBaselineSnapshot {
  version: number;
  generatedAt: string;
  playerSeasonCount: number;
  seasonRange: { min: number; max: number };
  playableEras: readonly string[];
  bucketCount: number;
  buckets: Record<string, number[]>;
}

export class PeerBaselineSnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PeerBaselineSnapshotError";
  }
}

let cachedIndex: PeerBaselineIndex | null = null;

export function resetPrecomputedPeerBaselineCacheForTests(): void {
  cachedIndex = null;
}

export function assertPeerBaselineSnapshot(
  value: unknown,
): asserts value is PeerBaselineSnapshot {
  if (value == null || typeof value !== "object") {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot is missing or not an object.");
  }
  const snapshot = value as Partial<PeerBaselineSnapshot>;
  if (snapshot.version !== PEER_BASELINE_SNAPSHOT_VERSION) {
    throw new PeerBaselineSnapshotError(
      `Peer baseline snapshot version ${String(snapshot.version)} is unsupported (expected ${PEER_BASELINE_SNAPSHOT_VERSION}). Regenerate with npm run scoring:build-baselines.`,
    );
  }
  if (!Number.isInteger(snapshot.playerSeasonCount) || (snapshot.playerSeasonCount ?? 0) <= 0) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot is missing playerSeasonCount.");
  }
  if (
    snapshot.seasonRange == null ||
    typeof snapshot.seasonRange.min !== "number" ||
    typeof snapshot.seasonRange.max !== "number"
  ) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot is missing seasonRange.");
  }
  if (!Array.isArray(snapshot.playableEras) || snapshot.playableEras.length === 0) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot is missing playableEras.");
  }
  if (snapshot.buckets == null || typeof snapshot.buckets !== "object" || Array.isArray(snapshot.buckets)) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot is missing buckets.");
  }
  const bucketCount = Object.keys(snapshot.buckets).length;
  if (bucketCount === 0) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot buckets are empty.");
  }
  if (snapshot.bucketCount !== bucketCount) {
    throw new PeerBaselineSnapshotError("Peer baseline snapshot bucketCount does not match buckets.");
  }
}

export function createPeerBaselineSnapshot(
  index: PeerBaselineIndex,
  meta: {
    playerSeasonCount: number;
    seasonRange: { min: number; max: number };
    generatedAt?: string;
  },
): PeerBaselineSnapshot {
  const buckets = serializePeerBaselineIndex(index);
  return {
    version: PEER_BASELINE_SNAPSHOT_VERSION,
    generatedAt: meta.generatedAt ?? new Date().toISOString(),
    playerSeasonCount: meta.playerSeasonCount,
    seasonRange: meta.seasonRange,
    playableEras: [...PLAYABLE_ERA_LABELS],
    bucketCount: Object.keys(buckets).length,
    buckets,
  };
}

export function peerBaselineIndexFromSnapshot(snapshot: unknown): PeerBaselineIndex {
  assertPeerBaselineSnapshot(snapshot);
  return peerBaselineIndexFromSerialized(snapshot.buckets);
}

export function loadPrecomputedPeerBaselines(): PeerBaselineIndex {
  if (cachedIndex) return cachedIndex;
  throw new PeerBaselineSnapshotError(
    "Peer baseline snapshot was not initialized. Import the generated snapshot via loadBundledPeerBaselines().",
  );
}

export function loadBundledPeerBaselines(snapshot: unknown): PeerBaselineIndex {
  if (cachedIndex) return cachedIndex;
  cachedIndex = peerBaselineIndexFromSnapshot(snapshot);
  return cachedIndex;
}
