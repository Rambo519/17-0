import { isNormalizedPosition, type NormalizedPosition } from "./positions";

/**
 * Historical NFL position labels are inconsistent across eras and data
 * providers. Every conversion from a raw source label to a game position must
 * go through this module.
 *
 * Phase 1 intentionally maps only unambiguous labels. Anything ambiguous
 * (H-BACK, E, WB, generic "B", ...) returns null so it can be resolved later
 * by a manual override rather than by a guess baked into the importer.
 */
const RAW_POSITION_ALIASES: Readonly<Record<string, NormalizedPosition>> = {
  QB: "QB",
  RB: "RB",
  HB: "RB",
  TB: "RB",
  FB: "FB",
  WR: "WR",
  FL: "WR",
  SE: "WR",
  TE: "TE",
};

export function normalizePosition(rawPosition: string | null | undefined): NormalizedPosition | null {
  if (!rawPosition) return null;

  const key = rawPosition.trim().toUpperCase();
  if (key.length === 0) return null;

  return RAW_POSITION_ALIASES[key] ?? null;
}

/**
 * True when a raw label has no confident mapping and therefore needs a manual
 * override before the player can become draftable.
 */
export function needsManualPositionReview(rawPosition: string | null | undefined): boolean {
  return normalizePosition(rawPosition) === null;
}

/**
 * Normalizes a set of raw labels, dropping the ones we cannot map and
 * de-duplicating the rest. Used by importers and by the dev seed.
 */
export function normalizePositions(rawPositions: readonly string[]): NormalizedPosition[] {
  const normalized = new Set<NormalizedPosition>();

  for (const raw of rawPositions) {
    const position = normalizePosition(raw);
    if (position) normalized.add(position);
  }

  return [...normalized];
}

export function assertNormalizedPosition(value: string): NormalizedPosition {
  if (!isNormalizedPosition(value)) {
    throw new Error(`Unsupported normalized position: ${value}`);
  }
  return value;
}

export const KNOWN_RAW_POSITIONS = Object.keys(RAW_POSITION_ALIASES);
