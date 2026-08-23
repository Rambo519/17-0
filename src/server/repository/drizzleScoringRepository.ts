import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
} from "@/db/schema";
import { isNormalizedPosition, type NormalizedPosition } from "@/lib/football/positions";
import type { DraftableCard } from "@/lib/game/types";
import type { ScoringRepository } from "@/lib/scoring/ports";
import type { SeasonStatRecord } from "@/lib/scoring/types";

import { createDrizzleGameRepository } from "./drizzleGameRepository";

function toSeasonStatRecord(
  row: {
    season: number;
    playerId: number;
    franchiseId: number;
    games: number | null;
    gamesStarted: number | null;
    passingYards: number | null;
    passingTouchdowns: number | null;
    interceptions: number | null;
    rushingYards: number | null;
    rushingAttempts: number | null;
    rushingTouchdowns: number | null;
    receptions: number | null;
    receivingYards: number | null;
    receivingTouchdowns: number | null;
    positions: string[] | null;
  },
): SeasonStatRecord {
  const positions = (row.positions ?? []).filter((value): value is NormalizedPosition =>
    isNormalizedPosition(value),
  );

  return {
    season: row.season,
    playerId: row.playerId,
    franchiseId: row.franchiseId,
    positions,
    games: row.games,
    gamesStarted: row.gamesStarted,
    passingYards: row.passingYards,
    passingTouchdowns: row.passingTouchdowns,
    interceptions: row.interceptions,
    rushingYards: row.rushingYards,
    rushingAttempts: row.rushingAttempts,
    rushingTouchdowns: row.rushingTouchdowns,
    receptions: row.receptions,
    receivingYards: row.receivingYards,
    receivingTouchdowns: row.receivingTouchdowns,
  };
}

export function createDrizzleScoringRepository(db: Database): ScoringRepository {
  const gameRepository = createDrizzleGameRepository(db);

  return {
    ...gameRepository,

    async findCards(cardIds: readonly number[]): Promise<DraftableCard[]> {
      if (cardIds.length === 0) return [];
      const cards = await Promise.all(cardIds.map((id) => gameRepository.findCard(id)));
      return cards.filter((card): card is DraftableCard => card != null);
    },

    async loadSeasonStatsForCards(cardIds: readonly number[]): Promise<Map<number, SeasonStatRecord[]>> {
      const result = new Map<number, SeasonStatRecord[]>();
      if (cardIds.length === 0) return result;

      const uniqueIds = [...new Set(cardIds)];
      const cards = await db
        .select({
          cardId: playerTeamEraCards.id,
          playerId: playerTeamEraCards.playerId,
          franchiseId: playerTeamEraCards.franchiseId,
          firstSeason: playerTeamEraCards.firstSeason,
          lastSeason: playerTeamEraCards.lastSeason,
        })
        .from(playerTeamEraCards)
        .where(inArray(playerTeamEraCards.id, uniqueIds));

      for (const card of cards) {
        const rows = await db
          .select({
            season: playerSeasons.season,
            playerId: playerSeasons.playerId,
            franchiseId: playerSeasons.franchiseId,
            games: playerSeasons.games,
            gamesStarted: playerSeasons.gamesStarted,
            passingYards: playerSeasons.passingYards,
            passingTouchdowns: playerSeasons.passingTouchdowns,
            interceptions: playerSeasons.interceptions,
            rushingYards: playerSeasons.rushingYards,
            rushingAttempts: playerSeasons.rushingAttempts,
            rushingTouchdowns: playerSeasons.rushingTouchdowns,
            receptions: playerSeasons.receptions,
            receivingYards: playerSeasons.receivingYards,
            receivingTouchdowns: playerSeasons.receivingTouchdowns,
            positions: sql<string[]>`array_agg(distinct ${playerSeasonPositions.position}::text)`,
          })
          .from(playerSeasons)
          .innerJoin(
            playerSeasonPositions,
            eq(playerSeasonPositions.playerSeasonId, playerSeasons.id),
          )
          .where(
            and(
              eq(playerSeasons.playerId, card.playerId),
              eq(playerSeasons.franchiseId, card.franchiseId),
              sql`${playerSeasons.season} between ${card.firstSeason} and ${card.lastSeason}`,
            ),
          )
          .groupBy(
            playerSeasons.id,
            playerSeasons.season,
            playerSeasons.playerId,
            playerSeasons.franchiseId,
            playerSeasons.games,
            playerSeasons.gamesStarted,
            playerSeasons.passingYards,
            playerSeasons.passingTouchdowns,
            playerSeasons.interceptions,
            playerSeasons.rushingYards,
            playerSeasons.rushingAttempts,
            playerSeasons.rushingTouchdowns,
            playerSeasons.receptions,
            playerSeasons.receivingYards,
            playerSeasons.receivingTouchdowns,
          );

        result.set(card.cardId, rows.map(toSeasonStatRecord));
      }

      return result;
    },

    async loadAllSeasonStatsForPeers(): Promise<SeasonStatRecord[]> {
      const rows = await db
        .select({
          season: playerSeasons.season,
          playerId: playerSeasons.playerId,
          franchiseId: playerSeasons.franchiseId,
          games: playerSeasons.games,
          gamesStarted: playerSeasons.gamesStarted,
          passingYards: playerSeasons.passingYards,
          passingTouchdowns: playerSeasons.passingTouchdowns,
          interceptions: playerSeasons.interceptions,
          rushingYards: playerSeasons.rushingYards,
          rushingAttempts: playerSeasons.rushingAttempts,
          rushingTouchdowns: playerSeasons.rushingTouchdowns,
          receptions: playerSeasons.receptions,
          receivingYards: playerSeasons.receivingYards,
          receivingTouchdowns: playerSeasons.receivingTouchdowns,
          positions: sql<string[]>`array_agg(distinct ${playerSeasonPositions.position}::text)`,
        })
        .from(playerSeasons)
        .innerJoin(
          playerSeasonPositions,
          eq(playerSeasonPositions.playerSeasonId, playerSeasons.id),
        )
        .groupBy(
          playerSeasons.id,
          playerSeasons.season,
          playerSeasons.playerId,
          playerSeasons.franchiseId,
          playerSeasons.games,
          playerSeasons.gamesStarted,
          playerSeasons.passingYards,
          playerSeasons.passingTouchdowns,
          playerSeasons.interceptions,
          playerSeasons.rushingYards,
          playerSeasons.rushingAttempts,
          playerSeasons.rushingTouchdowns,
          playerSeasons.receptions,
          playerSeasons.receivingYards,
          playerSeasons.receivingTouchdowns,
        );

      return rows.map(toSeasonStatRecord);
    },
  };
}
