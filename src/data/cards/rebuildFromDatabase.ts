/**
 * Apply position overrides onto existing player_season_positions, then rebuild
 * player-team-era cards. Used by `data:build-cards` so override edits do not
 * require a full destructive re-import.
 */
import { notInArray } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  gamePicks,
  gameSessions,
  players,
  playerSeasonPositions,
  playerSeasons,
} from "@/db/schema";
import {
  derivePlayerTeamEraCards,
  replacePlayerTeamEraCards,
  type CardStintInput,
} from "@/data/cards/buildCards";
import {
  applyPositionOverrides,
  loadPositionOverrides,
  type PositionOverride,
} from "@/data/positions/overrides";
import { eraDefinitionForSeason, PLAYABLE_ERA_DEFINITIONS } from "@/lib/football/eras";
import type { NormalizedPosition } from "@/lib/football/positions";

export interface ApplyOverridesResult {
  seasonsTouched: number;
  positionsInserted: number;
  cardsWritten: number;
  overridesLoaded: number;
}

/** Drop non-playable eras (e.g. legacy 1960s) from the eras table. */
export async function syncPlayableErasTable(db: Database): Promise<void> {
  const labels = PLAYABLE_ERA_DEFINITIONS.map((era) => era.label);
  await db.delete(eras).where(notInArray(eras.label, labels));

  const existing = await db.select({ label: eras.label }).from(eras);
  const have = new Set(existing.map((row) => row.label));
  const missing = PLAYABLE_ERA_DEFINITIONS.filter((era) => !have.has(era.label));
  if (missing.length > 0) {
    await db.insert(eras).values(missing.map((era) => ({ ...era })));
  }
}

export async function applyOverridesAndRebuildCards(
  db: Database,
  overrides?: PositionOverride[],
): Promise<ApplyOverridesResult> {
  const loaded = overrides ?? (await loadPositionOverrides());
  const seasonRows = await db.select().from(playerSeasons);
  const positionRows = await db.select().from(playerSeasonPositions);
  const playerRows = await db.select().from(players);
  const franchiseRows = await db.select().from(franchises);
  const eraRows = await db.select().from(eras);

  const playerById = new Map(playerRows.map((row) => [row.id, row]));
  const franchiseById = new Map(franchiseRows.map((row) => [row.id, row]));
  const eraIdByLabel = new Map(eraRows.map((era) => [era.label, era.id]));

  const positionsBySeasonId = new Map<number, NormalizedPosition[]>();
  for (const row of positionRows) {
    const list = positionsBySeasonId.get(row.playerSeasonId) ?? [];
    list.push(row.position);
    positionsBySeasonId.set(row.playerSeasonId, list);
  }

  let seasonsTouched = 0;
  let positionsInserted = 0;
  const toInsert: {
    playerSeasonId: number;
    position: NormalizedPosition;
    isManualOverride: boolean;
    notes: string | null;
  }[] = [];

  for (const season of seasonRows) {
    const player = playerById.get(season.playerId);
    const franchise = franchiseById.get(season.franchiseId);
    if (!player || !franchise) continue;

    const automatic = positionsBySeasonId.get(season.id) ?? [];
    const { positions, applied } = applyPositionOverrides(automatic, loaded, {
      gsisId: player.gsisId,
      playerName: player.displayName,
      franchiseSlug: franchise.slug,
      season: season.season,
    });

    if (applied.length === 0) {
      positionsBySeasonId.set(season.id, automatic);
      continue;
    }

    seasonsTouched += 1;
    const existing = new Set(automatic);
    const notes = applied.map((item) => item.reason).join("; ");
    for (const position of positions) {
      if (existing.has(position)) continue;
      toInsert.push({
        playerSeasonId: season.id,
        position,
        isManualOverride: true,
        notes,
      });
      existing.add(position);
      positionsInserted += 1;
    }
    positionsBySeasonId.set(season.id, [...existing]);
  }

  if (toInsert.length > 0) {
    const chunk = 400;
    for (let i = 0; i < toInsert.length; i += chunk) {
      await db.insert(playerSeasonPositions).values(toInsert.slice(i, i + chunk));
    }
  }

  const stintMap = new Map<string, CardStintInput>();
  for (const season of seasonRows) {
    const era = eraDefinitionForSeason(season.season);
    const eraId = era ? eraIdByLabel.get(era.label) : undefined;
    if (eraId === undefined) continue;

    const key = `${season.playerId}|${season.franchiseId}`;
    const stint = stintMap.get(key) ?? {
      playerId: season.playerId,
      franchiseId: season.franchiseId,
      seasons: [],
    };
    stint.seasons = [
      ...stint.seasons,
      {
        season: season.season,
        eraId,
        positions: positionsBySeasonId.get(season.id) ?? [],
        games: season.games,
        rosterStatus: season.rosterStatus,
        hasRosterEvidence: season.rosterStatus != null,
        passingYards: season.passingYards,
        passingTouchdowns: season.passingTouchdowns,
        rushingAttempts: season.rushingAttempts,
        rushingYards: season.rushingYards,
        rushingTouchdowns: season.rushingTouchdowns,
        receptions: season.receptions,
        receivingYards: season.receivingYards,
        receivingTouchdowns: season.receivingTouchdowns,
      },
    ];
    stintMap.set(key, stint);
  }

  const cards = derivePlayerTeamEraCards([...stintMap.values()]);
  // Card ids are referenced by game_picks; clear sessions before replacing cards.
  await db.delete(gamePicks);
  await db.delete(gameSessions);
  const cardsWritten = await replacePlayerTeamEraCards(db, cards);
  await syncPlayableErasTable(db);

  return {
    seasonsTouched,
    positionsInserted,
    cardsWritten,
    overridesLoaded: loaded.length,
  };
}

/** @deprecated Prefer applyOverridesAndRebuildCards for override-aware rebuilds. */
export async function rebuildCardsFromDatabase(db: Database): Promise<number> {
  const result = await applyOverridesAndRebuildCards(db);
  return result.cardsWritten;
}
