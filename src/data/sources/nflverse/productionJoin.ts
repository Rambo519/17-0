import { resolveFranchiseAlias } from "@/data/franchises/aliases";

/**
 * Join key for nflverse roster rows ↔ weekly player_stats.
 *
 * Roster CSVs and player_stats CSVs do not always share the same team
 * abbreviation. Typical mismatches in 2002–2015:
 * - Texans rosters `HST` vs player_stats `HOU`
 * - Ravens rosters `BLT` vs player_stats `BAL`
 * - Cardinals `ARZ` vs `ARI`, Browns `CLV` vs `CLE`, etc.
 *
 * Both codes resolve to the same franchise slug through the season-aware
 * alias table, so production attaches to the franchise rather than a raw
 * source code.
 *
 * Returns null when the abbreviation is unmapped or inactive for that season
 * (e.g. HOU 1999, between Oilers and Texans).
 */
export function nflverseProductionJoinKey(
  gsisId: string,
  teamAbbr: string,
  season: number,
): string | null {
  const alias = resolveFranchiseAlias(teamAbbr, season);
  if (!alias.ok) return null;
  return `${gsisId}|${alias.slug}|${season}`;
}
