/**
 * nflverse weekly player_stats include REG and POST rows in the same file.
 * Season production for scoring must use regular-season weeks only.
 */

export const NFLVERSE_REGULAR_SEASON_TYPE = "REG";

export function isNflverseRegularSeasonType(
  seasonType: string | undefined | null,
): boolean {
  return (seasonType ?? "").trim().toUpperCase() === NFLVERSE_REGULAR_SEASON_TYPE;
}

export interface NflverseSeasonProduction {
  games: number;
  passingYards: number;
  passingTouchdowns: number;
  /** Passing interceptions thrown. Null only when no REG week reported the field. */
  interceptions: number | null;
  rushingYards: number;
  rushingTouchdowns: number;
  receptions: number;
  receivingYards: number;
  receivingTouchdowns: number;
}

export interface NflverseWeekStatRow {
  player_id?: string;
  recent_team?: string;
  week?: string;
  season_type?: string;
  passing_yards?: string;
  passing_tds?: string;
  interceptions?: string;
  rushing_yards?: string;
  rushing_tds?: string;
  receptions?: string;
  receiving_yards?: string;
  receiving_tds?: string;
}

function parseStatNumber(value: string | undefined): number {
  if (value == null || value.trim() === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** True zero stays 0. Blank/missing stays unavailable rather than becoming 0. */
export function parseOptionalStatNumber(value: string | undefined): number | null {
  if (value == null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function emptyNflverseSeasonProduction(): NflverseSeasonProduction {
  return {
    games: 0,
    passingYards: 0,
    passingTouchdowns: 0,
    interceptions: null,
    rushingYards: 0,
    rushingTouchdowns: 0,
    receptions: 0,
    receivingYards: 0,
    receivingTouchdowns: 0,
  };
}

export type NflverseWeekAccumulateResult =
  | "added"
  | "skipped-non-regular"
  | "skipped-duplicate"
  | "skipped-invalid";

/**
 * Adds one weekly row to season totals when it is a unique regular-season week.
 * `joinKey` is the player/team/season key from `nflverseProductionJoinKey`.
 */
export function accumulateNflverseRegularSeasonWeek(
  totals: Map<string, NflverseSeasonProduction>,
  seenWeeks: Set<string>,
  joinKey: string,
  row: NflverseWeekStatRow,
): NflverseWeekAccumulateResult {
  const week = row.week?.trim();
  if (!week) return "skipped-invalid";
  if (!isNflverseRegularSeasonType(row.season_type)) return "skipped-non-regular";

  const weekKey = `${joinKey}|${week}|${NFLVERSE_REGULAR_SEASON_TYPE}`;
  if (seenWeeks.has(weekKey)) return "skipped-duplicate";
  seenWeeks.add(weekKey);

  const current = totals.get(joinKey) ?? emptyNflverseSeasonProduction();
  current.games += 1;
  current.passingYards += parseStatNumber(row.passing_yards);
  current.passingTouchdowns += parseStatNumber(row.passing_tds);
  const interceptions = parseOptionalStatNumber(row.interceptions);
  if (interceptions != null) {
    current.interceptions = (current.interceptions ?? 0) + interceptions;
  }
  current.rushingYards += parseStatNumber(row.rushing_yards);
  current.rushingTouchdowns += parseStatNumber(row.rushing_tds);
  current.receptions += parseStatNumber(row.receptions);
  current.receivingYards += parseStatNumber(row.receiving_yards);
  current.receivingTouchdowns += parseStatNumber(row.receiving_tds);
  totals.set(joinKey, current);
  return "added";
}
