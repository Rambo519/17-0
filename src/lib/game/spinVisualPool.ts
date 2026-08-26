import { FRANCHISE_LINEAGES } from "@/data/franchises/lineages";
import { PLAYABLE_ERA_LABELS } from "@/lib/football/eras";

export interface VisualFranchise {
  abbreviation: string;
  name: string;
}

export const VISUAL_FRANCHISES: readonly VisualFranchise[] = FRANCHISE_LINEAGES.map(
  (franchise) => ({
    abbreviation: franchise.canonicalAbbreviation,
    name: franchise.canonicalName,
  }),
);

export const VISUAL_ERAS: readonly string[] = PLAYABLE_ERA_LABELS;

export function pickVisualFranchise(
  rng: () => number,
  avoidAbbreviation?: string,
): VisualFranchise {
  const pool =
    avoidAbbreviation == null
      ? VISUAL_FRANCHISES
      : VISUAL_FRANCHISES.filter((entry) => entry.abbreviation !== avoidAbbreviation);
  const source = pool.length > 0 ? pool : VISUAL_FRANCHISES;
  return source[Math.floor(rng() * source.length)] ?? VISUAL_FRANCHISES[0]!;
}

export function pickVisualEra(rng: () => number, avoidLabel?: string): string {
  const pool =
    avoidLabel == null ? VISUAL_ERAS : VISUAL_ERAS.filter((label) => label !== avoidLabel);
  const source = pool.length > 0 ? pool : VISUAL_ERAS;
  return source[Math.floor(rng() * source.length)] ?? VISUAL_ERAS[0]!;
}
