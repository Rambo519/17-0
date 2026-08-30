import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  players,
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import { isNormalizedPosition, type NormalizedPosition } from "@/lib/football/positions";
import type { DraftableCard } from "@/lib/game/types";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
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
      const uniqueIds = [...new Set(cardIds)];
      const rows = await db
        .select({
          cardId: playerTeamEraCards.id,
          playerId: playerTeamEraCards.playerId,
          playerName: players.displayName,
          franchiseId: playerTeamEraCards.franchiseId,
          franchiseName: franchises.canonicalName,
          franchiseAbbreviation: franchises.canonicalAbbreviation,
          eraId: playerTeamEraCards.eraId,
          eraLabel: eras.label,
          firstSeason: playerTeamEraCards.firstSeason,
          lastSeason: playerTeamEraCards.lastSeason,
          representativeSeason: playerTeamEraCards.representativeSeason,
          draftable: playerTeamEraCards.draftable,
          positions: sql<string[]>`array_agg(distinct ${playerTeamEraPositions.position}::text)`,
        })
        .from(playerTeamEraCards)
        .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
        .innerJoin(franchises, eq(franchises.id, playerTeamEraCards.franchiseId))
        .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
        .innerJoin(
          playerTeamEraPositions,
          eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
        )
        .where(inArray(playerTeamEraCards.id, uniqueIds))
        .groupBy(
          playerTeamEraCards.id,
          players.displayName,
          franchises.canonicalName,
          franchises.canonicalAbbreviation,
          eras.label,
        );

      const byId = new Map(
        rows.map((row) => {
          const positions = (row.positions ?? []).filter((value): value is NormalizedPosition =>
            isNormalizedPosition(value),
          );
          const card: DraftableCard = {
            cardId: row.cardId,
            playerId: row.playerId,
            playerName: row.playerName,
            franchiseId: row.franchiseId,
            franchiseName: row.franchiseName,
            franchiseAbbreviation: row.franchiseAbbreviation,
            eraId: row.eraId,
            eraLabel: row.eraLabel,
            firstSeason: row.firstSeason,
            lastSeason: row.lastSeason,
            representativeSeason: row.representativeSeason,
            draftable: row.draftable,
            positions,
            production: EMPTY_PRODUCTION,
          };
          return [row.cardId, card] as const;
        }),
      );

      return cardIds.map((id) => byId.get(id)).filter((card): card is DraftableCard => card != null);
    },

    async loadSeasonStatsForCards(cardIds: readonly number[]): Promise<Map<number, SeasonStatRecord[]>> {
      const result = new Map<number, SeasonStatRecord[]>();
      if (cardIds.length === 0) return result;

      const uniqueIds = [...new Set(cardIds)];
      const rows = await db
        .select({
          cardId: playerTeamEraCards.id,
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
        .from(playerTeamEraCards)
        .innerJoin(
          playerSeasons,
          and(
            eq(playerSeasons.playerId, playerTeamEraCards.playerId),
            eq(playerSeasons.franchiseId, playerTeamEraCards.franchiseId),
            sql`${playerSeasons.season} between ${playerTeamEraCards.firstSeason} and ${playerTeamEraCards.lastSeason}`,
          ),
        )
        .innerJoin(
          playerSeasonPositions,
          eq(playerSeasonPositions.playerSeasonId, playerSeasons.id),
        )
        .where(inArray(playerTeamEraCards.id, uniqueIds))
        .groupBy(
          playerTeamEraCards.id,
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

      for (const row of rows) {
        const list = result.get(row.cardId) ?? [];
        list.push(toSeasonStatRecord(row));
        result.set(row.cardId, list);
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
