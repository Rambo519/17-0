import { normalizePlayerName } from "@/data/sources/historicalStats/normalizeName";
import type { HistoricalSeasonStats } from "@/data/sources/historicalStats/types";

export interface PlayerSeasonIdentity {
  playerSeasonId: number;
  playerId: number;
  franchiseId: number;
  season: number;
  displayName: string;
  franchiseSlug: string;
}

export type IdentityMatchStatus = "matched" | "ambiguous" | "unresolved";

export interface IdentityMatchResult {
  status: IdentityMatchStatus;
  stats: HistoricalSeasonStats;
  matched?: PlayerSeasonIdentity;
  candidates: PlayerSeasonIdentity[];
  reason: string;
}

/**
 * Resolve a historical leaderboard row onto existing player_season identities.
 *
 * Prefer unique (normalized name + season). When a franchise signal exists,
 * narrow to that franchise. Never silently pick among ambiguous candidates.
 */
export function resolveHistoricalIdentity(
  stats: HistoricalSeasonStats,
  seasonsByNameSeason: Map<string, PlayerSeasonIdentity[]>,
): IdentityMatchResult {
  const key = `${stats.season}|${stats.normalizedName}`;
  let candidates = seasonsByNameSeason.get(key) ?? [];

  if (candidates.length === 0) {
    return {
      status: "unresolved",
      stats,
      candidates: [],
      reason: "no player_season with matching name for season",
    };
  }

  if (stats.franchiseSlug) {
    const narrowed = candidates.filter((c) => c.franchiseSlug === stats.franchiseSlug);
    if (narrowed.length === 1) {
      return {
        status: "matched",
        stats,
        matched: narrowed[0],
        candidates: narrowed,
        reason: "name + season + franchise",
      };
    }
    if (narrowed.length === 0) {
      return {
        status: "unresolved",
        stats,
        candidates,
        reason: "name matched but franchise slug did not",
      };
    }
    return {
      status: "ambiguous",
      stats,
      candidates: narrowed,
      reason: "multiple player_seasons for name + season + franchise",
    };
  }

  const uniquePlayerIds = new Set(candidates.map((c) => c.playerId));
  if (uniquePlayerIds.size === 1 && candidates.length === 1) {
    return {
      status: "matched",
      stats,
      matched: candidates[0],
      candidates,
      reason: "unique name + season",
    };
  }

  if (uniquePlayerIds.size === 1 && candidates.length > 1) {
    // Mid-season trade: same player, multiple franchise rows. Season leaderboard
    // totals are not split; do not attach to either row silently.
    return {
      status: "ambiguous",
      stats,
      candidates,
      reason: "player traded mid-season (multiple franchise rows)",
    };
  }

  return {
    status: "ambiguous",
    stats,
    candidates,
    reason: "multiple distinct players share name in season",
  };
}

export function indexPlayerSeasonsForIdentity(
  rows: readonly PlayerSeasonIdentity[],
): Map<string, PlayerSeasonIdentity[]> {
  const index = new Map<string, PlayerSeasonIdentity[]>();

  for (const row of rows) {
    const normalized = normalizePlayerName(row.displayName);
    const key = `${row.season}|${normalized}`;
    const list = index.get(key) ?? [];
    list.push(row);
    index.set(key, list);
  }

  return index;
}
