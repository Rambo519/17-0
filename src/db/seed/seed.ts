import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  franchiseSeasons,
  gamePicks,
  gameSessions,
  players,
  playerSeasonPositions,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import { ERA_DEFINITIONS, eraDefinitionForSeason } from "@/lib/football/eras";
import { normalizePosition, normalizePositions } from "@/lib/football/normalizePosition";
import type { NormalizedPosition } from "@/lib/football/positions";

import { DEV_FRANCHISES, DEV_PLAYERS, DEV_SEED_SOURCE, type DevFranchise } from "./devData";

export interface SeedSummary {
  eras: number;
  franchises: number;
  franchiseSeasons: number;
  players: number;
  playerSeasons: number;
  cards: number;
  skippedSeasons: number;
}

function seasonNaming(franchise: DevFranchise, season: number) {
  const historical = franchise.history.find((entry) => season <= entry.throughSeason);
  return {
    displayName: historical?.displayName ?? franchise.canonicalName,
    abbreviation: historical?.abbreviation ?? franchise.canonicalAbbreviation,
  };
}

interface StintAccumulator {
  playerId: number;
  franchiseId: number;
  eraId: number;
  firstSeason: number;
  lastSeason: number;
  representativeSeason: number | null;
  bestGames: number;
  positions: Set<NormalizedPosition>;
}

/** Wipes every table so the dev seed is deterministic and re-runnable. */
async function reset(db: Database): Promise<void> {
  await db.delete(gamePicks);
  await db.delete(gameSessions);
  await db.delete(playerTeamEraPositions);
  await db.delete(playerTeamEraCards);
  await db.delete(playerSeasonPositions);
  await db.delete(playerSeasons);
  await db.delete(players);
  await db.delete(franchiseSeasons);
  await db.delete(franchises);
  await db.delete(eras);
}

export async function seedDevelopmentData(db: Database): Promise<SeedSummary> {
  await reset(db);

  const eraRows = await db
    .insert(eras)
    .values(ERA_DEFINITIONS.map((era) => ({ ...era })))
    .returning();
  const eraIdByLabel = new Map(eraRows.map((era) => [era.label, era.id]));

  const franchiseRows = await db
    .insert(franchises)
    .values(
      DEV_FRANCHISES.map((franchise) => ({
        slug: franchise.slug,
        canonicalName: franchise.canonicalName,
        canonicalAbbreviation: franchise.canonicalAbbreviation,
      })),
    )
    .returning();
  const franchiseIdBySlug = new Map(franchiseRows.map((franchise) => [franchise.slug, franchise.id]));

  const seasonsByFranchise = new Map<string, Set<number>>();
  for (const player of DEV_PLAYERS) {
    for (const stint of player.stints) {
      const seasons = seasonsByFranchise.get(stint.franchiseSlug) ?? new Set<number>();
      for (const season of stint.seasons) seasons.add(season.season);
      seasonsByFranchise.set(stint.franchiseSlug, seasons);
    }
  }

  const franchiseSeasonValues = DEV_FRANCHISES.flatMap((franchise) => {
    const franchiseId = franchiseIdBySlug.get(franchise.slug);
    if (franchiseId === undefined) return [];

    return [...(seasonsByFranchise.get(franchise.slug) ?? [])]
      .sort((a, b) => a - b)
      .map((season) => ({ franchiseId, season, active: true, ...seasonNaming(franchise, season) }));
  });

  if (franchiseSeasonValues.length > 0) {
    await db.insert(franchiseSeasons).values(franchiseSeasonValues);
  }

  const stints = new Map<string, StintAccumulator>();
  let playerSeasonCount = 0;
  let skippedSeasons = 0;

  for (const devPlayer of DEV_PLAYERS) {
    const displayName = `${devPlayer.firstName} ${devPlayer.lastName}`;
    const [playerRow] = await db
      .insert(players)
      .values({
        firstName: devPlayer.firstName,
        lastName: devPlayer.lastName,
        displayName,
        externalId: `${DEV_SEED_SOURCE}:${devPlayer.firstName}-${devPlayer.lastName}`.toLowerCase(),
      })
      .returning();
    if (!playerRow) throw new Error(`Failed to insert player ${displayName}`);

    for (const stint of devPlayer.stints) {
      const franchiseId = franchiseIdBySlug.get(stint.franchiseSlug);
      if (franchiseId === undefined) {
        throw new Error(`Unknown franchise slug in dev data: ${stint.franchiseSlug}`);
      }

      for (const season of stint.seasons) {
        const primary = normalizePosition(season.rawPosition);
        const era = eraDefinitionForSeason(season.season);
        const eraId = era ? eraIdByLabel.get(era.label) : undefined;

        // Unmappable raw positions and out-of-range seasons are skipped rather
        // than guessed; they would need a manual override to become draftable.
        if (!primary || eraId === undefined) {
          skippedSeasons += 1;
          continue;
        }

        const eligible = normalizePositions([season.rawPosition, ...season.alsoEligible]);

        const [playerSeasonRow] = await db
          .insert(playerSeasons)
          .values({
            playerId: playerRow.id,
            franchiseId,
            season: season.season,
            rawPosition: season.rawPosition,
            primaryNormalizedPosition: primary,
            source: DEV_SEED_SOURCE,
            ...(season.stats ?? {}),
          })
          .returning();
        if (!playerSeasonRow) throw new Error(`Failed to insert season for ${displayName}`);
        playerSeasonCount += 1;

        await db.insert(playerSeasonPositions).values(
          eligible.map((position) => ({
            playerSeasonId: playerSeasonRow.id,
            position,
            isManualOverride: false,
          })),
        );

        const key = `${playerRow.id}:${franchiseId}:${eraId}`;
        const existing = stints.get(key);
        const games = season.stats?.games ?? 0;

        if (!existing) {
          stints.set(key, {
            playerId: playerRow.id,
            franchiseId,
            eraId,
            firstSeason: season.season,
            lastSeason: season.season,
            representativeSeason: games > 0 ? season.season : null,
            bestGames: games,
            positions: new Set(eligible),
          });
          continue;
        }

        existing.firstSeason = Math.min(existing.firstSeason, season.season);
        existing.lastSeason = Math.max(existing.lastSeason, season.season);
        for (const position of eligible) existing.positions.add(position);
        if (games > existing.bestGames) {
          existing.bestGames = games;
          existing.representativeSeason = season.season;
        }
      }
    }
  }

  let cardCount = 0;
  for (const stint of stints.values()) {
    const [cardRow] = await db
      .insert(playerTeamEraCards)
      .values({
        playerId: stint.playerId,
        franchiseId: stint.franchiseId,
        eraId: stint.eraId,
        firstSeason: stint.firstSeason,
        lastSeason: stint.lastSeason,
        representativeSeason: stint.representativeSeason,
        draftable: stint.positions.size > 0,
      })
      .returning();
    if (!cardRow) throw new Error("Failed to insert player/team/era card");

    await db.insert(playerTeamEraPositions).values(
      [...stint.positions].map((position) => ({
        playerTeamEraCardId: cardRow.id,
        position,
      })),
    );
    cardCount += 1;
  }

  return {
    eras: eraRows.length,
    franchises: franchiseRows.length,
    franchiseSeasons: franchiseSeasonValues.length,
    players: DEV_PLAYERS.length,
    playerSeasons: playerSeasonCount,
    cards: cardCount,
    skippedSeasons,
  };
}
