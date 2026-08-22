import { readFile } from "node:fs/promises";
import path from "node:path";

import type { NormalizedPosition } from "@/lib/football/positions";
import { isNormalizedPosition } from "@/lib/football/positions";

/**
 * Manual eligibility overlays applied AFTER automatic position normalization.
 *
 * Keep this file small in Phase 2 — prefer auditing FB coverage before mass
 * curation. Overrides never invent players; they only widen/narrow positions.
 */

export interface PositionOverride {
  /** Prefer matching on GSIS when present. */
  gsisId?: string;
  /** Case-insensitive display name fallback. */
  playerName?: string;
  franchiseSlug?: string;
  /** Inclusive season range. Omit either bound for open-ended. */
  fromSeason?: number;
  toSeason?: number;
  eligiblePositions: NormalizedPosition[];
  reason: string;
}

export interface PositionOverridesFile {
  overrides: PositionOverride[];
}

const DEFAULT_OVERRIDES_PATH = path.join(
  process.cwd(),
  "data",
  "overrides",
  "position-overrides.json",
);

export async function loadPositionOverrides(
  filePath: string = DEFAULT_OVERRIDES_PATH,
): Promise<PositionOverride[]> {
  try {
    const raw = await readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as PositionOverridesFile;
    return (parsed.overrides ?? []).map(validateOverride);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

function validateOverride(override: PositionOverride): PositionOverride {
  if (!override.eligiblePositions?.length) {
    throw new Error(`Override missing eligiblePositions: ${JSON.stringify(override)}`);
  }
  for (const position of override.eligiblePositions) {
    if (!isNormalizedPosition(position)) {
      throw new Error(`Override has invalid position ${position}`);
    }
  }
  if (!override.gsisId && !override.playerName) {
    throw new Error(`Override needs gsisId or playerName: ${JSON.stringify(override)}`);
  }
  if (!override.reason?.trim()) {
    throw new Error(`Override needs a reason: ${JSON.stringify(override)}`);
  }
  return override;
}

export interface OverrideMatchContext {
  gsisId: string | null;
  playerName: string;
  franchiseSlug: string;
  season: number;
}

export function findMatchingOverrides(
  overrides: readonly PositionOverride[],
  context: OverrideMatchContext,
): PositionOverride[] {
  return overrides.filter((override) => {
    if (override.gsisId) {
      if (!context.gsisId || override.gsisId !== context.gsisId) return false;
    } else if (override.playerName) {
      if (override.playerName.trim().toLowerCase() !== context.playerName.trim().toLowerCase()) {
        return false;
      }
    }

    if (override.franchiseSlug && override.franchiseSlug !== context.franchiseSlug) {
      return false;
    }
    if (override.fromSeason != null && context.season < override.fromSeason) return false;
    if (override.toSeason != null && context.season > override.toSeason) return false;
    return true;
  });
}

/**
 * Automatic positions first, then union any matching override positions.
 * Overrides never remove automatic mappings in Phase 2 — they only add.
 */
export function applyPositionOverrides(
  automatic: readonly NormalizedPosition[],
  overrides: readonly PositionOverride[],
  context: OverrideMatchContext,
): { positions: NormalizedPosition[]; applied: PositionOverride[] } {
  const matched = findMatchingOverrides(overrides, context);
  const positions = new Set<NormalizedPosition>(automatic);
  for (const override of matched) {
    for (const position of override.eligiblePositions) positions.add(position);
  }
  return { positions: [...positions], applied: matched };
}
