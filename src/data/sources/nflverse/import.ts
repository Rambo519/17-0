import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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
import {
  derivePlayerTeamEraCards,
  replacePlayerTeamEraCards,
  type CardStintInput,
} from "@/data/cards/buildCards";
import { resolveFranchiseAlias } from "@/data/franchises/aliases";
import {
  FRANCHISE_LINEAGES,
  namingForSeason,
  seasonsForFranchise,
} from "@/data/franchises/lineages";
import {
  applyPositionOverrides,
  loadPositionOverrides,
  type PositionOverride,
} from "@/data/positions/overrides";
import {
  assertDestructiveImportAllowed,
  type DataDatabaseKind,
} from "@/data/safety/destructiveImport";
import { ERA_DEFINITIONS, eraDefinitionForSeason } from "@/lib/football/eras";
import type { NormalizedPosition } from "@/lib/football/positions";

import {
  NFLVERSE_DEFAULT_CUTOFF_SEASON,
  NFLVERSE_IMPORT_START_SEASON,
  NFLVERSE_PLAYER_STATS_START_SEASON,
  type NflverseManifest,
} from "./config";
import {
  NFLVERSE_MANIFEST_PATH,
  NFLVERSE_ROSTERS_DIR,
  NFLVERSE_STATS_DIR,
  loadManifest,
  readCsvRows,
} from "./download";
import { isSkillEligibleRosterRow, normalizeRosterPositions } from "./positions";

const SOURCE = "nflverse";
const INSERT_CHUNK = 400;

export interface ImportSummary {
  cutoffSeason: number;
  eras: number;
  franchises: number;
  franchiseSeasons: number;
  players: number;
  playerSeasons: number;
  cards: number;
  draftableCards: number;
  diagnostics: {
    unmappedAbbreviations: Record<string, number>;
    inactiveAbbreviations: Record<string, number>;
    unmappedPositions: Record<string, number>;
    duplicatePlayerTeamSeason: number;
    skippedNonSkill: number;
    skippedUnmappedFranchise: number;
    skippedNoPosition: number;
    overridesApplied: number;
  };
  manifest: NflverseManifest;
}

interface PendingPlayer {
  key: string;
  firstName: string;
  lastName: string;
  displayName: string;
  gsisId: string | null;
  pfrId: string | null;
  externalId: string;
  birthKey: string | null;
}

interface PendingSeason {
  playerKey: string;
  franchiseSlug: string;
  season: number;
  rawPosition: string;
  primary: NormalizedPosition;
  positions: NormalizedPosition[];
  rosterStatus: string | null;
  games: number | null;
  displayName: string;
  overrideNotes: string[];
}

function bump(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function birthNameKey(displayName: string, birthDate: string): string {
  return `nflverse:name:${displayName.trim().toLowerCase()}|${birthDate.trim()}`;
}

async function resetHistoricalTables(db: Database): Promise<void> {
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

async function insertChunks<T>(
  values: T[],
  write: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < values.length; i += INSERT_CHUNK) {
    const chunk = values.slice(i, i + INSERT_CHUNK);
    if (chunk.length > 0) await write(chunk);
  }
}

async function loadGamesByPlayerTeamSeason(
  cutoffSeason: number,
): Promise<Map<string, number>> {
  const weekKeys = new Set<string>();

  for (
    let season = NFLVERSE_PLAYER_STATS_START_SEASON;
    season <= cutoffSeason;
    season += 1
  ) {
    const filePath = path.join(NFLVERSE_STATS_DIR, `player_stats_${season}.csv`);
    try {
      for await (const row of readCsvRows(filePath)) {
        const gsisId = row.player_id?.trim();
        const team = row.recent_team?.trim().toUpperCase();
        const week = row.week?.trim();
        if (!gsisId || !team || !week) continue;
        weekKeys.add(`${gsisId}|${team}|${season}|${week}|${row.season_type ?? ""}`);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
  }

  const collapsed = new Map<string, number>();
  for (const weekKey of weekKeys) {
    const [gsisId, team, season] = weekKey.split("|");
    if (!gsisId || !team || !season) continue;
    const key = `${gsisId}|${team}|${season}`;
    collapsed.set(key, (collapsed.get(key) ?? 0) + 1);
  }
  return collapsed;
}

function lookupGames(
  gamesByKey: Map<string, number>,
  gsisId: string | null,
  teamAbbr: string,
  season: number,
): number | null {
  if (!gsisId) return null;
  const direct = gamesByKey.get(`${gsisId}|${teamAbbr.toUpperCase()}|${season}`);
  if (direct != null) return direct;

  // Stats files use modern abbreviations; try common lineage codes.
  for (const abbr of ["LA", "LAR", "LAC", "LV", "LVR", "OAK", "SD", "STL", "WAS", "WSH"]) {
    const value = gamesByKey.get(`${gsisId}|${abbr}|${season}`);
    if (value != null) return value;
  }
  return null;
}

export async function importNflverseHistoricalData(
  db: Database,
  options: {
    cutoffSeason?: number;
    overrides?: PositionOverride[];
    /** Required so Postgres targets cannot wipe tables without an explicit opt-in. */
    databaseKind: DataDatabaseKind;
  },
): Promise<ImportSummary> {
  // Abort before any DELETE when targeting DATABASE_URL / Postgres.
  assertDestructiveImportAllowed(options.databaseKind);

  let manifest: NflverseManifest;
  try {
    manifest = await loadManifest();
  } catch {
    throw new Error(
      `Missing nflverse manifest at ${NFLVERSE_MANIFEST_PATH}. Run npm run data:download first.`,
    );
  }

  const cutoffSeason =
    options.cutoffSeason ?? manifest.importCutoffSeason ?? NFLVERSE_DEFAULT_CUTOFF_SEASON;
  const overrides = options.overrides ?? (await loadPositionOverrides());

  const unmappedAbbreviations = new Map<string, number>();
  const inactiveAbbreviations = new Map<string, number>();
  const unmappedPositions = new Map<string, number>();
  let duplicatePlayerTeamSeason = 0;
  let skippedNonSkill = 0;
  let skippedUnmappedFranchise = 0;
  let skippedNoPosition = 0;
  let overridesApplied = 0;

  await resetHistoricalTables(db);

  const eraRows = await db
    .insert(eras)
    .values(ERA_DEFINITIONS.map((era) => ({ ...era })))
    .returning();
  const eraIdByLabel = new Map(eraRows.map((era) => [era.label, era.id]));

  const franchiseRows = await db
    .insert(franchises)
    .values(
      FRANCHISE_LINEAGES.map((lineage) => ({
        slug: lineage.slug,
        canonicalName: lineage.canonicalName,
        canonicalAbbreviation: lineage.canonicalAbbreviation,
      })),
    )
    .returning();
  const franchiseIdBySlug = new Map(franchiseRows.map((row) => [row.slug, row.id]));

  const franchiseSeasonValues = FRANCHISE_LINEAGES.flatMap((lineage) => {
    const franchiseId = franchiseIdBySlug.get(lineage.slug);
    if (franchiseId === undefined) return [];
    return seasonsForFranchise(lineage, NFLVERSE_IMPORT_START_SEASON, cutoffSeason).map(
      (season) => ({
        franchiseId,
        season,
        active: true,
        ...namingForSeason(lineage, season),
      }),
    );
  });
  await insertChunks(franchiseSeasonValues, (chunk) => db.insert(franchiseSeasons).values(chunk));

  process.stdout.write("Loading player_stats game counts...\n");
  const gamesByKey = await loadGamesByPlayerTeamSeason(cutoffSeason);

  const playersByKey = new Map<string, PendingPlayer>();
  const gsisToKey = new Map<string, string>();
  const pfrToKey = new Map<string, string>();
  const birthToKey = new Map<string, string>();
  const pendingSeasons = new Map<string, PendingSeason>();

  function resolvePlayerKey(input: {
    displayName: string;
    firstName: string;
    lastName: string;
    gsisId: string | null;
    pfrId: string | null;
    birthDate: string;
  }): string {
    const birthKey = input.birthDate ? birthNameKey(input.displayName, input.birthDate) : null;

    const existingKey =
      (input.gsisId ? gsisToKey.get(input.gsisId) : undefined) ??
      (input.pfrId ? pfrToKey.get(input.pfrId) : undefined) ??
      (birthKey ? birthToKey.get(birthKey) : undefined);

    if (existingKey) {
      const player = playersByKey.get(existingKey);
      if (player) {
        if (input.gsisId && !player.gsisId) player.gsisId = input.gsisId;
        if (input.pfrId && !player.pfrId) player.pfrId = input.pfrId;
        if (input.gsisId) gsisToKey.set(input.gsisId, existingKey);
        if (input.pfrId) pfrToKey.set(input.pfrId, existingKey);
        if (birthKey) birthToKey.set(birthKey, existingKey);
      }
      return existingKey;
    }

    const externalId =
      (input.gsisId ? `nflverse:gsis:${input.gsisId}` : null) ??
      (input.pfrId ? `nflverse:pfr:${input.pfrId}` : null) ??
      birthKey ??
      `nflverse:anon:${input.displayName.toLowerCase()}:${playersByKey.size}`;

    const key = externalId;
    playersByKey.set(key, {
      key,
      firstName: input.firstName,
      lastName: input.lastName,
      displayName: input.displayName,
      gsisId: input.gsisId,
      pfrId: input.pfrId,
      externalId,
      birthKey,
    });
    if (input.gsisId) gsisToKey.set(input.gsisId, key);
    if (input.pfrId) pfrToKey.set(input.pfrId, key);
    if (birthKey) birthToKey.set(birthKey, key);
    return key;
  }

  for (let season = NFLVERSE_IMPORT_START_SEASON; season <= cutoffSeason; season += 1) {
    const rosterPath = path.join(NFLVERSE_ROSTERS_DIR, `roster_${season}.csv`);
    process.stdout.write(`Scanning roster ${season}...\n`);

    for await (const row of readCsvRows(rosterPath)) {
      const team = row.team?.trim() ?? "";
      const position = row.position ?? "";
      const depthChartPosition = row.depth_chart_position ?? "";

      if (!isSkillEligibleRosterRow({ position, depthChartPosition })) {
        skippedNonSkill += 1;
        continue;
      }

      const alias = resolveFranchiseAlias(team, season);
      if (!alias.ok) {
        skippedUnmappedFranchise += 1;
        if (alias.reason === "inactive") bump(inactiveAbbreviations, `${team}@${season}`);
        else bump(unmappedAbbreviations, `${team}@${season}`);
        continue;
      }

      const normalized = normalizeRosterPositions({ position, depthChartPosition });
      for (const label of normalized.unmappedLabels) bump(unmappedPositions, label);

      const displayName =
        row.full_name?.trim() ||
        `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() ||
        "Unknown Player";
      const gsisId = row.gsis_id?.trim() || null;
      const pfrId = row.pfr_id?.trim() || null;

      const overrideResult = applyPositionOverrides(normalized.automatic, overrides, {
        gsisId,
        playerName: displayName,
        franchiseSlug: alias.slug,
        season,
      });
      if (overrideResult.applied.length > 0) overridesApplied += overrideResult.applied.length;

      const positionList = overrideResult.positions;
      const primary = normalized.primary ?? positionList[0] ?? null;
      if (!primary || positionList.length === 0) {
        skippedNoPosition += 1;
        continue;
      }

      const playerKey = resolvePlayerKey({
        displayName,
        firstName: row.first_name?.trim() || displayName.split(/\s+/)[0] || "Unknown",
        lastName:
          row.last_name?.trim() || displayName.split(/\s+/).slice(1).join(" ") || "Unknown",
        gsisId,
        pfrId,
        birthDate: row.birth_date?.trim() || "",
      });

      const seasonKey = `${playerKey}|${alias.slug}|${season}`;
      const games = lookupGames(gamesByKey, gsisId, team, season);
      const existing = pendingSeasons.get(seasonKey);
      if (existing) {
        duplicatePlayerTeamSeason += 1;
        for (const pos of positionList) {
          if (!existing.positions.includes(pos)) existing.positions.push(pos);
        }
        if (games != null) existing.games = Math.max(existing.games ?? 0, games);
        continue;
      }

      pendingSeasons.set(seasonKey, {
        playerKey,
        franchiseSlug: alias.slug,
        season,
        rawPosition: normalized.rawPosition || position || depthChartPosition,
        primary,
        positions: [...positionList],
        rosterStatus: row.status?.trim() || null,
        games,
        displayName,
        overrideNotes: overrideResult.applied.map((item) => item.reason),
      });
    }
  }

  process.stdout.write(`Inserting ${playersByKey.size} players...\n`);
  const playerValues = [...playersByKey.values()].map((player) => ({
    firstName: player.firstName,
    lastName: player.lastName,
    displayName: player.displayName,
    gsisId: player.gsisId,
    pfrId: player.pfrId,
    externalId: player.externalId,
  }));

  // gsis_id unique constraint: nulls are fine; ensure we don't insert duplicate gsis
  await insertChunks(playerValues, (chunk) => db.insert(players).values(chunk));

  const playerRows = await db.select().from(players);
  const playerIdByExternal = new Map(playerRows.map((row) => [row.externalId ?? "", row.id]));
  // Also index by gsis for safety
  for (const row of playerRows) {
    if (row.gsisId) playerIdByExternal.set(`nflverse:gsis:${row.gsisId}`, row.id);
  }

  process.stdout.write(`Inserting ${pendingSeasons.size} player-seasons...\n`);
  const seasonInserts: {
    playerId: number;
    franchiseId: number;
    season: number;
    rawPosition: string;
    primaryNormalizedPosition: NormalizedPosition;
    games: number | null;
    rosterStatus: string | null;
    source: string;
    positions: NormalizedPosition[];
    overrideNotes: string[];
  }[] = [];

  for (const pending of pendingSeasons.values()) {
    const playerId = playerIdByExternal.get(pending.playerKey);
    const franchiseId = franchiseIdBySlug.get(pending.franchiseSlug);
    if (playerId === undefined || franchiseId === undefined) continue;

    seasonInserts.push({
      playerId,
      franchiseId,
      season: pending.season,
      rawPosition: pending.rawPosition,
      primaryNormalizedPosition: pending.primary,
      games: pending.games,
      rosterStatus: pending.rosterStatus,
      source: SOURCE,
      positions: pending.positions,
      overrideNotes: pending.overrideNotes,
    });
  }

  for (let i = 0; i < seasonInserts.length; i += INSERT_CHUNK) {
    const chunk = seasonInserts.slice(i, i + INSERT_CHUNK);
    const inserted = await db
      .insert(playerSeasons)
      .values(
        chunk.map((row) => ({
          playerId: row.playerId,
          franchiseId: row.franchiseId,
          season: row.season,
          rawPosition: row.rawPosition,
          primaryNormalizedPosition: row.primaryNormalizedPosition,
          games: row.games,
          rosterStatus: row.rosterStatus,
          source: row.source,
        })),
      )
      .returning({ id: playerSeasons.id });

    const positionValues = inserted.flatMap((row, index) => {
      const source = chunk[index];
      if (!source) return [];
      return source.positions.map((position) => ({
        playerSeasonId: row.id,
        position,
        isManualOverride: source.overrideNotes.length > 0,
        notes: source.overrideNotes.length > 0 ? source.overrideNotes.join("; ") : null,
      }));
    });
    if (positionValues.length > 0) {
      await db.insert(playerSeasonPositions).values(positionValues);
    }
  }

  const stintMap = new Map<string, CardStintInput>();
  for (const row of seasonInserts) {
    const era = eraDefinitionForSeason(row.season);
    const eraId = era ? eraIdByLabel.get(era.label) : undefined;
    if (eraId === undefined) continue;

    const key = `${row.playerId}|${row.franchiseId}`;
    const stint = stintMap.get(key) ?? {
      playerId: row.playerId,
      franchiseId: row.franchiseId,
      seasons: [],
    };
    stint.seasons = [
      ...stint.seasons,
      {
        season: row.season,
        eraId,
        positions: row.positions,
        games: row.games,
        rosterStatus: row.rosterStatus,
        hasRosterEvidence: true,
      },
    ];
    stintMap.set(key, stint);
  }

  process.stdout.write("Building player-team-era cards...\n");
  const cards = derivePlayerTeamEraCards([...stintMap.values()]);
  const cardCount = await replacePlayerTeamEraCards(db, cards);
  const draftableCards = cards.filter((card) => card.draftable).length;

  const summary: ImportSummary = {
    cutoffSeason,
    eras: eraRows.length,
    franchises: franchiseRows.length,
    franchiseSeasons: franchiseSeasonValues.length,
    players: playerRows.length,
    playerSeasons: seasonInserts.length,
    cards: cardCount,
    draftableCards,
    diagnostics: {
      unmappedAbbreviations: Object.fromEntries(unmappedAbbreviations),
      inactiveAbbreviations: Object.fromEntries(inactiveAbbreviations),
      unmappedPositions: Object.fromEntries(unmappedPositions),
      duplicatePlayerTeamSeason,
      skippedNonSkill,
      skippedUnmappedFranchise,
      skippedNoPosition,
      overridesApplied,
    },
    manifest: { ...manifest, importCutoffSeason: cutoffSeason },
  };

  await mkdir(path.join(process.cwd(), "data", "reports"), { recursive: true });
  await writeFile(
    path.join(process.cwd(), "data", "reports", "import-summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8",
  );

  return summary;
}

/** Rebuild cards from player seasons already stored in the database. */
export async function rebuildCardsFromDatabase(db: Database): Promise<number> {
  const seasonRows = await db.select().from(playerSeasons);
  const positionRows = await db.select().from(playerSeasonPositions);
  const positionsBySeasonId = new Map<number, NormalizedPosition[]>();
  for (const row of positionRows) {
    const list = positionsBySeasonId.get(row.playerSeasonId) ?? [];
    list.push(row.position);
    positionsBySeasonId.set(row.playerSeasonId, list);
  }

  const eraRows = await db.select().from(eras);
  const eraIdByLabel = new Map(eraRows.map((era) => [era.label, era.id]));

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
      },
    ];
    stintMap.set(key, stint);
  }

  const cards = derivePlayerTeamEraCards([...stintMap.values()]);
  return replacePlayerTeamEraCards(db, cards);
}
