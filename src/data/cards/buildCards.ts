import type { Database } from "@/db/client";
import { playerTeamEraCards, playerTeamEraPositions } from "@/db/schema";
import { isCardDraftable, productionEvidenceFrom, type SeasonParticipation } from "@/data/draftable";
import type { NormalizedPosition } from "@/lib/football/positions";

/**
 * Shared card derivation: one player + one franchise + one era → one card.
 * Used by the historical importer (and tests). Never hand-write cards.
 */

export interface CardSeasonInput extends SeasonParticipation {
  season: number;
  eraId: number;
  positions: readonly NormalizedPosition[];
}

export interface CardStintInput {
  playerId: number;
  franchiseId: number;
  seasons: readonly CardSeasonInput[];
}

export interface BuiltCard {
  playerId: number;
  franchiseId: number;
  eraId: number;
  firstSeason: number;
  lastSeason: number;
  representativeSeason: number | null;
  positions: NormalizedPosition[];
  draftable: boolean;
}

export function derivePlayerTeamEraCards(stints: readonly CardStintInput[]): BuiltCard[] {
  const groups = new Map<
    string,
    {
      playerId: number;
      franchiseId: number;
      eraId: number;
      firstSeason: number;
      lastSeason: number;
      representativeSeason: number | null;
      bestGames: number;
      positions: Set<NormalizedPosition>;
      seasons: SeasonParticipation[];
    }
  >();

  for (const stint of stints) {
    for (const season of stint.seasons) {
      const key = `${stint.playerId}:${stint.franchiseId}:${season.eraId}`;
      const existing = groups.get(key);
      const games = season.games ?? 0;

      if (!existing) {
        groups.set(key, {
          playerId: stint.playerId,
          franchiseId: stint.franchiseId,
          eraId: season.eraId,
          firstSeason: season.season,
          lastSeason: season.season,
          representativeSeason: games > 0 ? season.season : null,
          bestGames: games,
          positions: new Set(season.positions),
          seasons: [toSeasonParticipation(season)],
        });
        continue;
      }

      existing.firstSeason = Math.min(existing.firstSeason, season.season);
      existing.lastSeason = Math.max(existing.lastSeason, season.season);
      for (const position of season.positions) existing.positions.add(position);
      existing.seasons.push(toSeasonParticipation(season));
      if (games > existing.bestGames) {
        existing.bestGames = games;
        existing.representativeSeason = season.season;
      }
    }
  }

  return [...groups.values()].map((group) => {
    const positions = [...group.positions];
    return {
      playerId: group.playerId,
      franchiseId: group.franchiseId,
      eraId: group.eraId,
      firstSeason: group.firstSeason,
      lastSeason: group.lastSeason,
      representativeSeason: group.representativeSeason,
      positions,
      draftable: isCardDraftable({ positions, seasons: group.seasons }),
    };
  });
}

/** Wipe and rewrite all player-team-era cards from derived stints. */
export async function replacePlayerTeamEraCards(
  db: Database,
  cards: readonly BuiltCard[],
): Promise<number> {
  await db.delete(playerTeamEraPositions);
  await db.delete(playerTeamEraCards);

  let written = 0;
  for (const card of cards) {
    if (card.positions.length === 0) continue;

    const [row] = await db
      .insert(playerTeamEraCards)
      .values({
        playerId: card.playerId,
        franchiseId: card.franchiseId,
        eraId: card.eraId,
        firstSeason: card.firstSeason,
        lastSeason: card.lastSeason,
        representativeSeason: card.representativeSeason,
        draftable: card.draftable,
      })
      .returning();
    if (!row) throw new Error("Failed to insert player/team/era card");

    await db.insert(playerTeamEraPositions).values(
      card.positions.map((position) => ({
        playerTeamEraCardId: row.id,
        position,
      })),
    );
    written += 1;
  }

  return written;
}

function toSeasonParticipation(season: CardSeasonInput): SeasonParticipation {
  return {
    ...productionEvidenceFrom(season),
    games: season.games,
    rosterStatus: season.rosterStatus,
    hasRosterEvidence: season.hasRosterEvidence,
    positions: season.positions,
  };
}
