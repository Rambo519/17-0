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

export const ERA_DEFINITIONS: readonly EraDefinition[] = [
  { label: "1960s", startYear: 1960, endYear: 1969 },
  { label: "1970s", startYear: 1970, endYear: 1979 },
  { label: "1980s", startYear: 1980, endYear: 1989 },
  { label: "1990s", startYear: 1990, endYear: 1999 },
  { label: "2000s", startYear: 2000, endYear: 2009 },
  { label: "2010s", startYear: 2010, endYear: 2019 },
  { label: "2020s", startYear: 2020, endYear: 2029 },
];

export function decadeStartYear(season: number): number {
  return Math.floor(season / 10) * 10;
}

export function decadeLabel(season: number): string {
  return `${decadeStartYear(season)}s`;
}

export function eraDefinitionForSeason(season: number): EraDefinition | null {
  return ERA_DEFINITIONS.find((era) => season >= era.startYear && season <= era.endYear) ?? null;
}
