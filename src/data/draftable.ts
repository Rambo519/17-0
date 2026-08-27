import type { NormalizedPosition } from "@/lib/football/positions";

/**
 * Draftability is about actual offensive participation, not roster membership.
 *
 * Stored evidence only — pass attempts/completions are parsed from 1970–1998
 * CSVs but are not persisted on player_seasons, so they cannot be used here.
 *
 * NULL is never treated as zero. Only a strictly positive stored value counts.
 */

export interface SeasonProductionEvidence {
  passingYards: number | null;
  passingTouchdowns: number | null;
  rushingAttempts: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}

export interface SeasonParticipation extends Partial<SeasonProductionEvidence> {
  games: number | null;
  rosterStatus: string | null;
  /** True when the row came from a roster feed that supplies status. */
  hasRosterEvidence: boolean;
  /** Season-level positions; used for the narrow FB exception. */
  positions?: readonly NormalizedPosition[];
}

const POSITIVE_EVIDENCE_FIELDS = [
  "passingYards",
  "passingTouchdowns",
  "rushingAttempts",
  "rushingYards",
  "rushingTouchdowns",
  "receptions",
  "receivingYards",
  "receivingTouchdowns",
] as const satisfies readonly (keyof SeasonProductionEvidence)[];

export const EMPTY_PRODUCTION_EVIDENCE: SeasonProductionEvidence = {
  passingYards: null,
  passingTouchdowns: null,
  rushingAttempts: null,
  rushingYards: null,
  rushingTouchdowns: null,
  receptions: null,
  receivingYards: null,
  receivingTouchdowns: null,
};

export function productionEvidenceFrom(
  input: Partial<SeasonProductionEvidence> | null | undefined,
): SeasonProductionEvidence {
  return {
    passingYards: input?.passingYards ?? null,
    passingTouchdowns: input?.passingTouchdowns ?? null,
    rushingAttempts: input?.rushingAttempts ?? null,
    rushingYards: input?.rushingYards ?? null,
    rushingTouchdowns: input?.rushingTouchdowns ?? null,
    receptions: input?.receptions ?? null,
    receivingYards: input?.receivingYards ?? null,
    receivingTouchdowns: input?.receivingTouchdowns ?? null,
  };
}

/** True only when a field is known and strictly greater than zero. */
export function isPositiveKnown(value: number | null | undefined): boolean {
  return value != null && value > 0;
}

export function hasOffensiveProductionEvidence(
  season: Partial<SeasonProductionEvidence> | null | undefined,
): boolean {
  const evidence = productionEvidenceFrom(season);
  return POSITIVE_EVIDENCE_FIELDS.some((field) => isPositiveKnown(evidence[field]));
}

/**
 * Blocking fullbacks can appear in game logs with games > 0 and almost no
 * box-score production. Roster-only FBs (games NULL, no production) stay out.
 */
export function qualifiesForFullbackParticipationException(
  season: SeasonParticipation,
  cardPositions: readonly NormalizedPosition[],
): boolean {
  if (season.games == null || season.games <= 0) return false;
  if (hasOffensiveProductionEvidence(season)) return false;
  const seasonPositions = season.positions ?? cardPositions;
  return seasonPositions.includes("FB");
}

export function seasonCountsAsParticipation(
  season: SeasonParticipation,
  cardPositions: readonly NormalizedPosition[] = season.positions ?? [],
): boolean {
  const produced = hasOffensiveProductionEvidence(season);

  if (season.games != null) {
    if (season.games <= 0) return false;
    if (produced) return true;
    return qualifiesForFullbackParticipationException(season, cardPositions);
  }

  return produced;
}

/**
 * Production CLASSIC can present as role-consistent for these positions.
 * QB rushing counts (option/scramble). WR/TE rushing-only gadget usage does not.
 */
export function hasRoleConsistentProduction(
  positions: readonly NormalizedPosition[],
  production: Partial<SeasonProductionEvidence>,
): boolean {
  const set = new Set(positions);

  if (set.has("QB")) {
    if (
      isPositiveKnown(production.passingYards) ||
      isPositiveKnown(production.passingTouchdowns) ||
      isPositiveKnown(production.rushingYards) ||
      isPositiveKnown(production.rushingTouchdowns)
    ) {
      return true;
    }
  }

  if (set.has("RB") || set.has("FB")) {
    if (
      isPositiveKnown(production.rushingYards) ||
      isPositiveKnown(production.rushingTouchdowns) ||
      isPositiveKnown(production.receptions) ||
      isPositiveKnown(production.receivingYards) ||
      isPositiveKnown(production.receivingTouchdowns)
    ) {
      return true;
    }
  }

  if (set.has("WR") || set.has("TE")) {
    if (
      isPositiveKnown(production.receptions) ||
      isPositiveKnown(production.receivingYards) ||
      isPositiveKnown(production.receivingTouchdowns)
    ) {
      return true;
    }
  }

  return false;
}

export function seasonCountsAsDraftableEvidence(
  season: SeasonParticipation,
  cardPositions: readonly NormalizedPosition[] = season.positions ?? [],
): boolean {
  if (qualifiesForFullbackParticipationException(season, cardPositions)) return true;
  if (!seasonCountsAsParticipation(season, cardPositions)) return false;
  const positions =
    season.positions && season.positions.length > 0 ? season.positions : cardPositions;
  return hasRoleConsistentProduction(positions, season);
}

export const DRAFTABLE_RULE_SUMMARY = [
  "Card needs ≥1 normalized skill position.",
  "games <= 0: not draftable.",
  "games > 0 with role-consistent offensive production: draftable.",
  "games > 0 with no offensive production: not draftable, except FB with games > 0.",
  "games NULL with role-consistent offensive production: draftable.",
  "games NULL with no offensive production: not draftable (roster status is not enough).",
  "WR/TE need receiving production; rush-only gadget usage is not a WR/TE draft card.",
  "QB rushing (without passing) is legitimate QB usage.",
].join(" ");

export function isCardDraftable(input: {
  positions: readonly NormalizedPosition[];
  seasons: readonly SeasonParticipation[];
}): boolean {
  if (input.positions.length === 0) return false;
  return input.seasons.some((season) => seasonCountsAsDraftableEvidence(season, input.positions));
}
