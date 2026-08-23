/**
 * Decade math lives here only. Application code should read eras from the
 * `eras` table; this module exists so the seed/import layer has exactly one
 * implementation of "which decade does this season belong to".
 */

export interface EraDefinition {
  label: string;
  startYear: number;
  endYear: number;
}

/** Supported playable product window: 1970s through 2020s. */
export const PLAYABLE_ERA_START_SEASON = 1970;

/**
 * Eras exposed to Spin, skips, and draftable cards. Pre-1970 seasons may exist
 * in roster history but never produce playable franchise-era combinations.
 */
export const PLAYABLE_ERA_DEFINITIONS: readonly EraDefinition[] = [
  { label: "1970s", startYear: 1970, endYear: 1979 },
  { label: "1980s", startYear: 1980, endYear: 1989 },
  { label: "1990s", startYear: 1990, endYear: 1999 },
  { label: "2000s", startYear: 2000, endYear: 2009 },
  { label: "2010s", startYear: 2010, endYear: 2019 },
  { label: "2020s", startYear: 2020, endYear: 2029 },
];

/** Alias for importers/seeds that populate the `eras` table. */
export const ERA_DEFINITIONS: readonly EraDefinition[] = PLAYABLE_ERA_DEFINITIONS;

export const PLAYABLE_ERA_LABELS: readonly string[] = PLAYABLE_ERA_DEFINITIONS.map(
  (era) => era.label,
);

export function isPlayableEraLabel(label: string): boolean {
  return PLAYABLE_ERA_LABELS.includes(label);
}

export function decadeStartYear(season: number): number {
  return Math.floor(season / 10) * 10;
}

export function decadeLabel(season: number): string {
  return `${decadeStartYear(season)}s`;
}

/** Returns the playable era for a season, or null for pre-1970 / out-of-range years. */
export function eraDefinitionForSeason(season: number): EraDefinition | null {
  return PLAYABLE_ERA_DEFINITIONS.find(
    (era) => season >= era.startYear && season <= era.endYear,
  ) ?? null;
}

export function isPlayableSeason(season: number): boolean {
  return eraDefinitionForSeason(season) != null;
}
