/**
 * Central season boundary between historical season-stat enrichment and
 * nflverse `player_stats` (authoritative for modern seasons).
 *
 * Change this in one place; importers and enrichment adapters must honor it.
 */
export const NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON = 1999;

/** Inclusive first season for historical skill-player production enrichment. */
export const HISTORICAL_STATS_START_SEASON = 1970;

/** Inclusive last season for historical enrichment (year before nflverse stats). */
export const HISTORICAL_STATS_END_SEASON = NFLVERSE_STATS_AUTHORITATIVE_FROM_SEASON - 1;
