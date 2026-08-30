import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Database } from "@/db/client";
import {
  createPeerBaselineSnapshot,
  PEER_BASELINE_SNAPSHOT_VERSION,
} from "@/lib/scoring/peerBaselineSnapshot";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import { createDrizzleScoringRepository } from "@/server/repository/drizzleScoringRepository";

/** Bundled with the app so Vercel /score never queries the peer-season corpus. */
export const PEER_BASELINE_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "src",
  "lib",
  "scoring",
  "generated",
  "peer-baselines.json",
);

export interface WritePeerBaselineSnapshotResult {
  path: string;
  version: number;
  playerSeasonCount: number;
  bucketCount: number;
  seasonRange: { min: number; max: number };
  bytes: number;
}

/**
 * Rebuild the committed peer-baseline snapshot from the current database.
 *
 * Required after:
 * - historical data import / player-season production changes
 * - position or peer-baseline rule changes
 *
 * Uses the existing `buildPeerBaselineIndex()` math. Does not change scoring.
 */
export async function writePeerBaselineSnapshot(
  db: Database,
): Promise<WritePeerBaselineSnapshotResult> {
  const repository = createDrizzleScoringRepository(db);
  const peerSeasons = await repository.loadAllSeasonStatsForPeers();
  if (peerSeasons.length === 0) {
    throw new Error("Cannot write peer baseline snapshot: no player-seasons in the database.");
  }

  const seasons = peerSeasons.map((row) => row.season);
  const snapshot = createPeerBaselineSnapshot(buildPeerBaselineIndex(peerSeasons), {
    playerSeasonCount: peerSeasons.length,
    seasonRange: {
      min: Math.min(...seasons),
      max: Math.max(...seasons),
    },
  });

  const json = `${JSON.stringify(snapshot)}\n`;
  await mkdir(path.dirname(PEER_BASELINE_SNAPSHOT_PATH), { recursive: true });
  await writeFile(PEER_BASELINE_SNAPSHOT_PATH, json, "utf8");

  return {
    path: PEER_BASELINE_SNAPSHOT_PATH,
    version: PEER_BASELINE_SNAPSHOT_VERSION,
    playerSeasonCount: snapshot.playerSeasonCount,
    bucketCount: snapshot.bucketCount,
    seasonRange: snapshot.seasonRange,
    bytes: Buffer.byteLength(json),
  };
}
