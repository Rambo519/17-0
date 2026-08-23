/**
 * nflverse source configuration. Committed so imports are reproducible;
 * downloaded raw files live under `.cache/nflverse/` (gitignored).
 */

import { NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON } from "@/data/sources/statsBoundary";

export const NFLVERSE_SOURCE_NAME = "nflverse";

/** Documented public release assets (GitHub Releases). */
export const NFLVERSE_ROSTERS_RELEASE =
  "https://github.com/nflverse/nflverse-data/releases/download/rosters";

export const NFLVERSE_PLAYER_STATS_RELEASE =
  "https://github.com/nflverse/nflverse-data/releases/download/player_stats";

export const NFLVERSE_IMPORT_START_SEASON = 1960;

/**
 * Latest completed NFL season reliably used for Phase 2.
 * Recorded in the manifest at download time; do not silently assume "current year".
 */
export const NFLVERSE_DEFAULT_CUTOFF_SEASON = 2025;

export const NFLVERSE_ROSTER_URL = (season: number): string =>
  `${NFLVERSE_ROSTERS_RELEASE}/roster_${season}.csv`;

export const NFLVERSE_PLAYER_STATS_URL = (season: number): string =>
  `${NFLVERSE_PLAYER_STATS_RELEASE}/player_stats_${season}.csv`;

/**
 * player_stats release coverage / authoritative modern production boundary.
 * Pre-1999 production is enriched via historical-stats adapters.
 */
export const NFLVERSE_PLAYER_STATS_START_SEASON = NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON;

export interface NflverseManifest {
  sourceName: string;
  retrievalMethod: string;
  rosterUrlTemplate: string;
  playerStatsUrlTemplate: string;
  importStartSeason: number;
  importCutoffSeason: number;
  playerStatsStartSeason: number;
  downloadedAt: string | null;
  seasonsDownloaded: number[];
  notes: string[];
}

export function createEmptyManifest(cutoffSeason: number): NflverseManifest {
  return {
    sourceName: NFLVERSE_SOURCE_NAME,
    retrievalMethod:
      "HTTP GET of public nflverse-data GitHub Release CSV assets (rosters + player_stats)",
    rosterUrlTemplate: NFLVERSE_ROSTER_URL(0).replace("roster_0.csv", "roster_{season}.csv"),
    playerStatsUrlTemplate: NFLVERSE_PLAYER_STATS_URL(0).replace(
      "player_stats_0.csv",
      "player_stats_{season}.csv",
    ),
    importStartSeason: NFLVERSE_IMPORT_START_SEASON,
    importCutoffSeason: cutoffSeason,
    playerStatsStartSeason: NFLVERSE_PLAYER_STATS_START_SEASON,
    downloadedAt: null,
    seasonsDownloaded: [],
    notes: [
      "Raw CSVs are cached under .cache/nflverse/ and are not committed.",
      "Game engine never calls nflverse at spin time.",
      "Import cutoff is the latest completed season configured for this run.",
    ],
  };
}
