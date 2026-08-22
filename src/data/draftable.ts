import type { NormalizedPosition } from "@/lib/football/positions";

/**
 * Phase 2 draftable threshold.
 *
 * Goal: keep players who genuinely appeared for the franchise while dropping
 * obvious non-participants (practice-squad / developmental noise), without
 * ranking talent yet.
 *
 * Rule for a player-team-era card:
 * 1. The card must have at least one normalized skill position.
 * 2. At least one contributing season must show participation evidence:
 *    - `games >= 1` when game counts are known (nflverse player_stats, 1999+), OR
 *    - roster `status === "ACT"` when we have roster evidence but no games, OR
 *    - if neither games nor roster status exists (synthetic fixtures), allow it
 *      so Phase 1-style seeds keep working.
 *
 * Tune later by changing this module only — never scatter thresholds in SQL.
 */

export interface SeasonParticipation {
  games: number | null;
  rosterStatus: string | null;
  /** True when the row came from a roster feed that supplies status. */
  hasRosterEvidence: boolean;
}

export const DRAFTABLE_RULE_SUMMARY = [
  "Card needs ≥1 normalized skill position.",
  "Participation: games >= 1 when known;",
  "else ACT roster status when roster evidence exists;",
  "else allow (fixtures / missing participation metadata).",
].join(" ");

export function seasonCountsAsParticipation(season: SeasonParticipation): boolean {
  if (season.games != null) return season.games >= 1;
  if (season.hasRosterEvidence) {
    return (season.rosterStatus ?? "").toUpperCase() === "ACT";
  }
  return true;
}

export function isCardDraftable(input: {
  positions: readonly NormalizedPosition[];
  seasons: readonly SeasonParticipation[];
}): boolean {
  if (input.positions.length === 0) return false;
  return input.seasons.some(seasonCountsAsParticipation);
}
