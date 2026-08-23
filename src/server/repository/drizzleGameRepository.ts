import { and, asc, eq, exists, inArray, notInArray, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  gamePicks,
  gameSessions,
  players,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import { isNormalizedPosition, type NormalizedPosition } from "@/lib/football/positions";
import { PLAYABLE_ERA_LABELS } from "@/lib/football/eras";
import { asNullableNumber, EMPTY_PRODUCTION } from "@/lib/game/production";
import type { DraftableCardFilter, GameRepository } from "@/lib/game/ports";
import type {
  CardProduction,
  DraftableCard,
  DraftPickRecord,
  GameSessionRecord,
  NewPick,
} from "@/lib/game/types";

const cardColumns = {
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
} as const;

const cardGroupBy = [
  playerTeamEraCards.id,
  players.displayName,
  franchises.canonicalName,
  franchises.canonicalAbbreviation,
  eras.label,
] as const;

/** Positions come back as `text[]`; drop anything the game doesn't understand. */
const positionsAggregate = sql<string[]>`array_agg(distinct ${playerTeamEraPositions.position}::text)`;

interface CardQueryRow {
  cardId: number;
  playerId: number;
  playerName: string;
  franchiseId: number;
  franchiseName: string;
  franchiseAbbreviation: string;
  eraId: number;
  eraLabel: string;
  firstSeason: number;
  lastSeason: number;
  representativeSeason: number | null;
  draftable: boolean;
  positions: string[] | null;
}

function toDraftableCard(row: CardQueryRow): DraftableCard {
  const positions = (row.positions ?? []).filter((value): value is NormalizedPosition =>
    isNormalizedPosition(value),
  );

  return {
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
    // Production is loaded separately for the spun candidate set only.
    production: EMPTY_PRODUCTION,
  };
}

export function createDrizzleGameRepository(db: Database): GameRepository {
  return {
    async createSession(input): Promise<GameSessionRecord> {
      const [session] = await db
        .insert(gameSessions)
        .values({
          mode: input.mode,
          teamSkipRemaining: 1,
          eraSkipRemaining: 1,
        })
        .returning();
      if (!session) throw new Error("Failed to create game session.");
      return session;
    },

    async findSession(sessionId: string): Promise<GameSessionRecord | null> {
      const [session] = await db
        .select()
        .from(gameSessions)
        .where(eq(gameSessions.id, sessionId))
        .limit(1);
      return session ?? null;
    },

    async listPicks(sessionId: string): Promise<DraftPickRecord[]> {
      return db
        .select({
          roundNumber: gamePicks.roundNumber,
          lineupSlot: gamePicks.lineupSlot,
          playerId: gamePicks.playerId,
          playerTeamEraCardId: gamePicks.playerTeamEraCardId,
          franchiseId: gamePicks.franchiseId,
          eraId: gamePicks.eraId,
          playerName: players.displayName,
          franchiseName: franchises.canonicalName,
          franchiseAbbreviation: franchises.canonicalAbbreviation,
          eraLabel: eras.label,
        })
        .from(gamePicks)
        .innerJoin(players, eq(players.id, gamePicks.playerId))
        .innerJoin(franchises, eq(franchises.id, gamePicks.franchiseId))
        .innerJoin(eras, eq(eras.id, gamePicks.eraId))
        .where(eq(gamePicks.gameSessionId, sessionId))
        .orderBy(asc(gamePicks.roundNumber));
    },

    async findCard(cardId: number): Promise<DraftableCard | null> {
      const rows = await db
        .select({ ...cardColumns, positions: positionsAggregate })
        .from(playerTeamEraCards)
        .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
        .innerJoin(franchises, eq(franchises.id, playerTeamEraCards.franchiseId))
        .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
        .innerJoin(
          playerTeamEraPositions,
          eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
        )
        .where(eq(playerTeamEraCards.id, cardId))
        .groupBy(...cardGroupBy);

      const row = rows[0];
      return row ? toDraftableCard(row) : null;
    },

    async listDraftableCards(filter: DraftableCardFilter): Promise<DraftableCard[]> {
      if (filter.positions.length === 0) return [];

      const conditions = [
        eq(playerTeamEraCards.draftable, true),
        inArray(eras.label, [...PLAYABLE_ERA_LABELS]),
        // EXISTS rather than a join filter, so the aggregate still returns the
        // card's full position list.
        exists(
          db
            .select({ one: sql`1` })
            .from(playerTeamEraPositions)
            .where(
              and(
                eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
                inArray(playerTeamEraPositions.position, [...filter.positions]),
              ),
            ),
        ),
      ];

      if (filter.excludePlayerIds.length > 0) {
        conditions.push(notInArray(playerTeamEraCards.playerId, [...filter.excludePlayerIds]));
      }
      if (filter.franchiseId !== undefined) {
        conditions.push(eq(playerTeamEraCards.franchiseId, filter.franchiseId));
      }
      if (filter.eraId !== undefined) {
        conditions.push(eq(playerTeamEraCards.eraId, filter.eraId));
      }

      const rows = await db
        .select({ ...cardColumns, positions: positionsAggregate })
        .from(playerTeamEraCards)
        .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
        .innerJoin(franchises, eq(franchises.id, playerTeamEraCards.franchiseId))
        .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
        .innerJoin(
          playerTeamEraPositions,
          eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
        )
        .where(and(...conditions))
        .groupBy(...cardGroupBy);

      return rows.map(toDraftableCard);
    },

    async getProductionForCards(cardIds: readonly number[]): Promise<Map<number, CardProduction>> {
      const result = new Map<number, CardProduction>();
      if (cardIds.length === 0) return result;

      const uniqueIds = [...new Set(cardIds)];
      const rows = await db
        .select({
          cardId: playerTeamEraCards.id,
          games: sql`sum(${playerSeasons.games})`,
          passingYards: sql`sum(${playerSeasons.passingYards})`,
          passingTouchdowns: sql`sum(${playerSeasons.passingTouchdowns})`,
          rushingYards: sql`sum(${playerSeasons.rushingYards})`,
          rushingTouchdowns: sql`sum(${playerSeasons.rushingTouchdowns})`,
          receptions: sql`sum(${playerSeasons.receptions})`,
          receivingYards: sql`sum(${playerSeasons.receivingYards})`,
          receivingTouchdowns: sql`sum(${playerSeasons.receivingTouchdowns})`,
        })
        .from(playerTeamEraCards)
        .leftJoin(
          playerSeasons,
          and(
            eq(playerSeasons.playerId, playerTeamEraCards.playerId),
            eq(playerSeasons.franchiseId, playerTeamEraCards.franchiseId),
            sql`${playerSeasons.season} between ${playerTeamEraCards.firstSeason} and ${playerTeamEraCards.lastSeason}`,
          ),
        )
        .where(inArray(playerTeamEraCards.id, uniqueIds))
        .groupBy(playerTeamEraCards.id);

      for (const id of uniqueIds) {
        result.set(id, EMPTY_PRODUCTION);
      }

      for (const row of rows) {
        result.set(row.cardId, {
          games: asNullableNumber(row.games),
          passingYards: asNullableNumber(row.passingYards),
          passingTouchdowns: asNullableNumber(row.passingTouchdowns),
          rushingYards: asNullableNumber(row.rushingYards),
          rushingTouchdowns: asNullableNumber(row.rushingTouchdowns),
          receptions: asNullableNumber(row.receptions),
          receivingYards: asNullableNumber(row.receivingYards),
          receivingTouchdowns: asNullableNumber(row.receivingTouchdowns),
        });
      }

      return result;
    },

    async setCurrentSpin(
      sessionId: string,
      target: { franchiseId: number; eraId: number } | null,
    ): Promise<void> {
      await db
        .update(gameSessions)
        .set({
          currentFranchiseId: target?.franchiseId ?? null,
          currentEraId: target?.eraId ?? null,
        })
        .where(eq(gameSessions.id, sessionId));
    },

    async applySkipSpin({ sessionId, kind, franchiseId, eraId }): Promise<void> {
      await db.transaction(async (tx) => {
        const [session] = await tx
          .select()
          .from(gameSessions)
          .where(eq(gameSessions.id, sessionId))
          .limit(1);
        if (!session) throw new Error(`Unknown session ${sessionId}`);

        if (kind === "TEAM") {
          if (session.teamSkipRemaining <= 0) {
            throw new Error("Team skip already consumed.");
          }
          await tx
            .update(gameSessions)
            .set({
              currentFranchiseId: franchiseId,
              currentEraId: eraId,
              teamSkipRemaining: session.teamSkipRemaining - 1,
            })
            .where(eq(gameSessions.id, sessionId));
          return;
        }

        if (session.eraSkipRemaining <= 0) {
          throw new Error("Era skip already consumed.");
        }
        await tx
          .update(gameSessions)
          .set({
            currentFranchiseId: franchiseId,
            currentEraId: eraId,
            eraSkipRemaining: session.eraSkipRemaining - 1,
          })
          .where(eq(gameSessions.id, sessionId));
      });
    },

    async commitPick({
      sessionId,
      pick,
      complete,
    }: {
      sessionId: string;
      pick: NewPick;
      complete: boolean;
    }): Promise<void> {
      await db.transaction(async (tx) => {
        await tx.insert(gamePicks).values({ gameSessionId: sessionId, ...pick });
        await tx
          .update(gameSessions)
          .set({
            currentFranchiseId: null,
            currentEraId: null,
            ...(complete ? { status: "COMPLETE" as const, completedAt: new Date() } : {}),
          })
          .where(eq(gameSessions.id, sessionId));
      });
    },
  };
}
