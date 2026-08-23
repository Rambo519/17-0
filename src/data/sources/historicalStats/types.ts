export type HistoricalStatCategory = "passing" | "rushing" | "receiving";

/**
 * Season production fields we can enrich. Unavailable source values stay null
 * (never coerced to zero).
 */
export interface HistoricalSeasonStats {
  playerName: string;
  normalizedName: string;
  season: number;
  sourceAdapter: string;
  /** Present only when the source row carried a resolvable franchise signal. */
  franchiseSlug: string | null;
  franchiseAbbr: string | null;

  games: number | null;
  gamesStarted: number | null;

  passingAttempts: number | null;
  completions: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  interceptions: number | null;

  rushingAttempts: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;

  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}

export function emptyHistoricalSeasonStats(
  playerName: string,
  normalizedName: string,
  season: number,
  sourceAdapter: string,
): HistoricalSeasonStats {
  return {
    playerName,
    normalizedName,
    season,
    sourceAdapter,
    franchiseSlug: null,
    franchiseAbbr: null,
    games: null,
    gamesStarted: null,
    passingAttempts: null,
    completions: null,
    passingYards: null,
    passingTouchdowns: null,
    interceptions: null,
    rushingAttempts: null,
    rushingYards: null,
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
  };
}

/** Merge category rows for the same player-season; later non-null wins per field. */
export function mergeHistoricalSeasonStats(
  base: HistoricalSeasonStats,
  next: HistoricalSeasonStats,
): HistoricalSeasonStats {
  return {
    ...base,
    sourceAdapter:
      base.sourceAdapter === next.sourceAdapter
        ? base.sourceAdapter
        : `${base.sourceAdapter}+${next.sourceAdapter}`,
    franchiseSlug: base.franchiseSlug ?? next.franchiseSlug,
    franchiseAbbr: base.franchiseAbbr ?? next.franchiseAbbr,
    games: base.games ?? next.games,
    gamesStarted: base.gamesStarted ?? next.gamesStarted,
    passingAttempts: base.passingAttempts ?? next.passingAttempts,
    completions: base.completions ?? next.completions,
    passingYards: base.passingYards ?? next.passingYards,
    passingTouchdowns: base.passingTouchdowns ?? next.passingTouchdowns,
    interceptions: base.interceptions ?? next.interceptions,
    rushingAttempts: base.rushingAttempts ?? next.rushingAttempts,
    rushingYards: base.rushingYards ?? next.rushingYards,
    rushingTouchdowns: base.rushingTouchdowns ?? next.rushingTouchdowns,
    receptions: base.receptions ?? next.receptions,
    receivingYards: base.receivingYards ?? next.receivingYards,
    receivingTouchdowns: base.receivingTouchdowns ?? next.receivingTouchdowns,
  };
}

export function hasAnyProduction(stats: HistoricalSeasonStats): boolean {
  return (
    stats.passingYards != null ||
    stats.passingTouchdowns != null ||
    stats.interceptions != null ||
    stats.rushingAttempts != null ||
    stats.rushingYards != null ||
    stats.rushingTouchdowns != null ||
    stats.receptions != null ||
    stats.receivingYards != null ||
    stats.receivingTouchdowns != null
  );
}
