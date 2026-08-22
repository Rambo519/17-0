import { and, asc, eq, exists, inArray, notInArray, sql, type AnyColumn } from "drizzle-orm";

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
import { asNullableNumber } from "@/lib/game/production";
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

function seasonSum(column: AnyColumn) {
  return sql`
    (
      select sum(${column})
      from ${playerSeasons}
      where ${playerSeasons.playerId} = ${playerTeamEraCards.playerId}
        and ${playerSeasons.franchiseId} = ${playerTeamEraCards.franchiseId}
        and ${playerSeasons.season} between ${playerTeamEraCards.firstSeason}
          and ${playerTeamEraCards.lastSeason}
    )
  `;
}

const productionColumns = {
  games: seasonSum(playerSeasons.games),
  passingYards: seasonSum(playerSeasons.passingYards),
  passingTouchdowns: seasonSum(playerSeasons.passingTouchdowns),
  rushingYards: seasonSum(playerSeasons.rushingYards),
  rushingTouchdowns: seasonSum(playerSeasons.rushingTouchdowns),
  receptions: seasonSum(playerSeasons.receptions),
  receivingYards: seasonSum(playerSeasons.receivingYards),
  receivingTouchdowns: seasonSum(playerSeasons.receivingTouchdowns),
} as const;

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
  games: unknown;
  passingYards: unknown;
  passingTouchdowns: unknown;
  rushingYards: unknown;
  rushingTouchdowns: unknown;
  receptions: unknown;
  receivingYards: unknown;
  receivingTouchdowns: unknown;
}

function toProduction(row: CardQueryRow): CardProduction {
  return {
    games: asNullableNumber(row.games),
    passingYards: asNullableNumber(row.passingYards),
    passingTouchdowns: asNullableNumber(row.passingTouchdowns),
    rushingYards: asNullableNumber(row.rushingYards),
    rushingTouchdowns: asNullableNumber(row.rushingTouchdowns),
    receptions: asNullableNumber(row.receptions),
    receivingYards: asNullableNumber(row.receivingYards),
    receivingTouchdowns: asNullableNumber(row.receivingTouchdowns),
  };
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
    production: toProduction(row),
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
        .select({ ...cardColumns, positions: positionsAggregate, ...productionColumns })
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
      return row ? toDraftableCard(row as CardQueryRow) : null;
    },

    async listDraftableCards(filter: DraftableCardFilter): Promise<DraftableCard[]> {
      if (filter.positions.length === 0) return [];

      const conditions = [
        eq(playerTeamEraCards.draftable, true),
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
        .select({ ...cardColumns, positions: positionsAggregate, ...productionColumns })
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

      return rows.map((row) => toDraftableCard(row as CardQueryRow));
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
