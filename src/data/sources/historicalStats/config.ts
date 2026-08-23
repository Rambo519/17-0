import {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
  NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
} from "@/data/sources/statsBoundary";

export {
  HISTORICAL_STATS_END_SEASON,
  HISTORICAL_STATS_START_SEASON,
  NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
};

/** Published NFL.com season CSVs mirrored on GitHub (no runtime scrape). */
export const MARCLINDER_SOURCE_NAME = "marclinder-nfl-stats";
export const MARCLINDER_START_SEASON = 1970;
export const MARCLINDER_END_SEASON = HISTORICAL_STATS_END_SEASON;
export const MARCLINDER_RAW_BASE =
  "https://raw.githubusercontent.com/MarcLinderGit/NFL_Stats/main/data";

export const MARCLINDER_CSV_URL = (
  season: number,
  category: "passing" | "rushing" | "receiving",
): string => `${MARCLINDER_RAW_BASE}/${season}/player/${category}.csv`;

export const HISTORICAL_ENRICHMENT_PROVENANCE = "nflverse+historical-stats";

export interface HistoricalStatsManifest {
  sourceName: string;
  retrievalMethod: string;
  adapters: {
    name: string;
    seasons: string;
    method: string;
    notes: string[];
  }[];
  historicalStartSeason: number;
  historicalEndSeason: number;
  nflverseAuthoritativeFromSeason: number;
  downloadedAt: string | null;
  seasonsDownloaded: number[];
  notes: string[];
}

export function createEmptyHistoricalManifest(): HistoricalStatsManifest {
  return {
    sourceName: "historical-season-stats",
    retrievalMethod:
      "HTTP GET of public MarcLinderGit/NFL_Stats CSVs (1970–1998 season leaderboards)",
    adapters: [
      {
        name: MARCLINDER_SOURCE_NAME,
        seasons: `${MARCLINDER_START_SEASON}–${MARCLINDER_END_SEASON}`,
        method: "GitHub raw CSV download (published NFL.com season leaderboards)",
        notes: [
          "No team column; identity uses name + season against existing nflverse roster rows.",
          "Games / games started are not present → left NULL.",
          "Does not replace nflverse player_stats for 1999+.",
        ],
      },
    ],
    historicalStartSeason: HISTORICAL_STATS_START_SEASON,
    historicalEndSeason: HISTORICAL_STATS_END_SEASON,
    nflverseAuthoritativeFromSeason: NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON,
    downloadedAt: null,
    seasonsDownloaded: [],
    notes: [
      "Raw files live under .cache/historical-stats/ and are not committed.",
      "Enrichment updates existing player_seasons only; it never creates roster rows.",
      `Seasons >= ${NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON} are skipped (nflverse authoritative).`,
      "Playable product begins in 1970; pre-1970 roster rows are not enriched.",
    ],
  };
}
