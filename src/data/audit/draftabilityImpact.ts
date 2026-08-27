import { inArray } from "drizzle-orm";

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
import { derivePlayerTeamEraCards, type CardStintInput } from "@/data/cards/buildCards";
import { eraDefinitionForSeason, PLAYABLE_ERA_LABELS } from "@/lib/football/eras";
import { NORMALIZED_POSITIONS, type NormalizedPosition } from "@/lib/football/positions";

export const DAL_2000S_WATCHLIST = [
  "Alonzo Coleman",
  "Cedric James",
  "Chauncey Washington",
  "Chris Fontenot",
  "Jon Kitna",
  "Michael Bates",
  "Mike Solwold",
  "Rodney Hannah",
] as const;

export interface PositionCounts {
  total: number;
  QB: number;
  RB: number;
  FB: number;
  WR: number;
  TE: number;
}

export interface FormationViability {
  combinations: number;
  fullFormationViable: number;
  lostViability: {
    franchise: string;
    abbreviation: string;
    era: string;
  }[];
}

export interface DalWatchlistRow {
  playerName: string;
  seasons: number[];
  positions: NormalizedPosition[];
  games: (number | null)[];
  production: {
    passingYards: number | null;
    passingTouchdowns: number | null;
    rushingAttempts: number | null;
    rushingYards: number | null;
    rushingTouchdowns: number | null;
    receptions: number | null;
    receivingYards: number | null;
    receivingTouchdowns: number | null;
  }[];
  previouslyDraftable: boolean;
  draftableAfter: boolean;
  reason: string;
}

export interface GamesPlayedAudit {
  playerSeasons: number;
  gamesPopulated: number;
  gamesNull: number;
  gamesZero: number;
  byEra: {
    era: string;
    seasons: number;
    gamesPopulated: number;
    gamesPopulatedPercent: number;
  }[];
  nullGamesWithProduction: number;
}

export interface DraftabilityImpactReport {
  games: GamesPlayedAudit;
  before: PositionCounts;
  after: PositionCounts;
  formationBefore: FormationViability;
  formationAfter: FormationViability;
  dal2000s: DalWatchlistRow[];
}

function emptyCounts(): PositionCounts {
  return { total: 0, QB: 0, RB: 0, FB: 0, WR: 0, TE: 0 };
}

function emptyPositionTally(): Record<NormalizedPosition, number> {
  return { QB: 0, RB: 0, FB: 0, WR: 0, TE: 0 };
}

function addPositions(counts: PositionCounts, positions: readonly NormalizedPosition[]): void {
  counts.total += 1;
  for (const position of NORMALIZED_POSITIONS) {
    if (positions.includes(position)) counts[position] += 1;
  }
}

function isViable(counts: Record<NormalizedPosition, number>): boolean {
  return counts.QB >= 1 && counts.RB >= 1 && counts.FB >= 1 && counts.WR >= 2 && counts.TE >= 1;
}

function hasProduction(row: {
  passingYards: number | null;
  passingTouchdowns: number | null;
  rushingAttempts: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}): boolean {
  return (
    (row.passingYards ?? 0) > 0 ||
    (row.passingTouchdowns ?? 0) > 0 ||
    (row.rushingAttempts ?? 0) > 0 ||
    (row.rushingYards ?? 0) > 0 ||
    (row.rushingTouchdowns ?? 0) > 0 ||
    (row.receptions ?? 0) > 0 ||
    (row.receivingYards ?? 0) > 0 ||
    (row.receivingTouchdowns ?? 0) > 0
  );
}

export async function runDraftabilityImpactAudit(db: Database): Promise<DraftabilityImpactReport> {
  const eraRows = await db.select().from(eras);
  const eraIdByLabel = new Map(eraRows.map((era) => [era.label, era.id]));
  const eraLabelById = new Map(eraRows.map((era) => [era.id, era.label]));
  const franchiseRows = await db.select().from(franchises);
  const franchiseById = new Map(franchiseRows.map((row) => [row.id, row]));

  const seasonRows = await db.select().from(playerSeasons);
  const positionRows = await db.select().from(playerSeasonPositions);
  const positionsBySeasonId = new Map<number, NormalizedPosition[]>();
  for (const row of positionRows) {
    const list = positionsBySeasonId.get(row.playerSeasonId) ?? [];
    list.push(row.position);
    positionsBySeasonId.set(row.playerSeasonId, list);
  }

  const games: GamesPlayedAudit = {
    playerSeasons: seasonRows.length,
    gamesPopulated: 0,
    gamesNull: 0,
    gamesZero: 0,
    byEra: [],
    nullGamesWithProduction: 0,
  };
  const eraBuckets = new Map<string, { seasons: number; gamesPopulated: number }>();

  for (const season of seasonRows) {
    const era = eraDefinitionForSeason(season.season);
    const label = era?.label ?? "non-playable";
    const bucket = eraBuckets.get(label) ?? { seasons: 0, gamesPopulated: 0 };
    bucket.seasons += 1;
    if (season.games == null) {
      games.gamesNull += 1;
      if (hasProduction(season)) games.nullGamesWithProduction += 1;
    } else {
      games.gamesPopulated += 1;
      bucket.gamesPopulated += 1;
      if (season.games === 0) games.gamesZero += 1;
    }
    eraBuckets.set(label, bucket);
  }

  games.byEra = [...eraBuckets.entries()]
    .map(([era, bucket]) => ({
      era,
      seasons: bucket.seasons,
      gamesPopulated: bucket.gamesPopulated,
      gamesPopulatedPercent:
        bucket.seasons === 0 ? 0 : Math.round((1000 * bucket.gamesPopulated) / bucket.seasons) / 10,
    }))
    .sort((a, b) => a.era.localeCompare(b.era));

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

  const proposed = derivePlayerTeamEraCards([...stintMap.values()]);
  const proposedKey = new Map<string, (typeof proposed)[number]>();
  for (const card of proposed) {
    proposedKey.set(`${card.playerId}|${card.franchiseId}|${card.eraId}`, card);
  }

  const existingCards = await db.select().from(playerTeamEraCards);
  const existingPositions = await db.select().from(playerTeamEraPositions);
  const positionsByCard = new Map<number, NormalizedPosition[]>();
  for (const row of existingPositions) {
    const list = positionsByCard.get(row.playerTeamEraCardId) ?? [];
    list.push(row.position);
    positionsByCard.set(row.playerTeamEraCardId, list);
  }

  const before = emptyCounts();
  const after = emptyCounts();
  const beforeCombo = new Map<string, Record<NormalizedPosition, number>>();
  const afterCombo = new Map<string, Record<NormalizedPosition, number>>();

  function comboCounts(map: Map<string, Record<NormalizedPosition, number>>, key: string) {
    const existing = map.get(key);
    if (existing) return existing;
    const created = emptyPositionTally();
    map.set(key, created);
    return created;
  }

  for (const card of existingCards) {
    const eraLabel = eraLabelById.get(card.eraId);
    if (!eraLabel || !(PLAYABLE_ERA_LABELS as readonly string[]).includes(eraLabel)) continue;
    const positions = positionsByCard.get(card.id) ?? [];
    const comboKey = `${card.franchiseId}|${card.eraId}`;
    if (card.draftable) {
      addPositions(before, positions);
      const counts = comboCounts(beforeCombo, comboKey);
      for (const position of positions) counts[position] += 1;
    }
    const next = proposedKey.get(`${card.playerId}|${card.franchiseId}|${card.eraId}`);
    if (next?.draftable) {
      addPositions(after, next.positions);
      const counts = comboCounts(afterCombo, comboKey);
      for (const position of next.positions) counts[position] += 1;
    }
  }

  function formationFrom(map: Map<string, Record<NormalizedPosition, number>>): FormationViability {
    let fullFormationViable = 0;
    for (const counts of map.values()) {
      if (isViable(counts)) fullFormationViable += 1;
    }
    return {
      combinations: map.size,
      fullFormationViable,
      lostViability: [],
    };
  }

  const formationBefore = formationFrom(beforeCombo);
  const formationAfter = formationFrom(afterCombo);
  const lostViability: FormationViability["lostViability"] = [];
  for (const [key, counts] of beforeCombo) {
    if (!isViable(counts)) continue;
    if (isViable(afterCombo.get(key) ?? emptyPositionTally())) continue;
    const [franchiseIdRaw, eraIdRaw] = key.split("|");
    const franchise = franchiseById.get(Number(franchiseIdRaw));
    const eraLabel = eraLabelById.get(Number(eraIdRaw));
    if (franchise && eraLabel) {
      lostViability.push({
        franchise: franchise.canonicalName,
        abbreviation: franchise.canonicalAbbreviation,
        era: eraLabel,
      });
    }
  }
  formationAfter.lostViability = lostViability;

  const dal = franchiseRows.find((row) => row.canonicalAbbreviation === "DAL");
  const era2000s = eraRows.find((row) => row.label === "2000s");
  const dal2000s: DalWatchlistRow[] = [];

  if (dal && era2000s) {
    const playerRows = await db
      .select()
      .from(players)
      .where(inArray(players.displayName, [...DAL_2000S_WATCHLIST]));

    for (const name of DAL_2000S_WATCHLIST) {
      const player = playerRows.find((row) => row.displayName === name);
      if (!player) {
        dal2000s.push({
          playerName: name,
          seasons: [],
          positions: [],
          games: [],
          production: [],
          previouslyDraftable: false,
          draftableAfter: false,
          reason: "No player row found in this database.",
        });
        continue;
      }

      const seasons = seasonRows
        .filter(
          (row) =>
            row.playerId === player.id &&
            row.franchiseId === dal.id &&
            row.season >= 2000 &&
            row.season <= 2009,
        )
        .sort((a, b) => a.season - b.season);

      const existing = existingCards.find(
        (card) =>
          card.playerId === player.id && card.franchiseId === dal.id && card.eraId === era2000s.id,
      );
      const next = proposedKey.get(`${player.id}|${dal.id}|${era2000s.id}`);
      const positions = [
        ...new Set(seasons.flatMap((season) => positionsBySeasonId.get(season.id) ?? [])),
      ];

      dal2000s.push({
        playerName: name,
        seasons: seasons.map((season) => season.season),
        positions,
        games: seasons.map((season) => season.games),
        production: seasons.map((season) => ({
          passingYards: season.passingYards,
          passingTouchdowns: season.passingTouchdowns,
          rushingAttempts: season.rushingAttempts,
          rushingYards: season.rushingYards,
          rushingTouchdowns: season.rushingTouchdowns,
          receptions: season.receptions,
          receivingYards: season.receivingYards,
          receivingTouchdowns: season.receivingTouchdowns,
        })),
        previouslyDraftable: existing?.draftable ?? false,
        draftableAfter: next?.draftable ?? false,
        reason: draftabilityReason(seasons.length, next?.draftable ?? false, existing?.draftable ?? false),
      });
    }
  }

  return {
    games,
    before,
    after,
    formationBefore,
    formationAfter,
    dal2000s,
  };
}

function draftabilityReason(seasonCount: number, after: boolean, before: boolean): string {
  if (seasonCount === 0) return "No DAL 2000s player-season rows.";
  if (before && !after) {
    return "Previously draftable from roster/games evidence; no offensive production (and not an FB games>0 exception).";
  }
  if (after) return "Kept: positive offensive production and/or FB games-played exception.";
  return "Not draftable under the participation rule.";
}

export function formatDraftabilityImpact(report: DraftabilityImpactReport): string {
  return [
    "Draftability impact simulation (does not write cards)",
    "",
    `Player-seasons: ${report.games.playerSeasons}`,
    `Games populated: ${report.games.gamesPopulated} (zero=${report.games.gamesZero})`,
    `Games NULL: ${report.games.gamesNull}`,
    `NULL games with positive production: ${report.games.nullGamesWithProduction}`,
    "",
    "Games populated by era:",
    ...report.games.byEra.map(
      (row) => `  ${row.era}: ${row.gamesPopulatedPercent}% (${row.gamesPopulated}/${row.seasons})`,
    ),
    "",
    `Draftable cards before: ${report.before.total}`,
    `Draftable cards after:  ${report.after.total}`,
    `  QB ${report.before.QB} → ${report.after.QB}`,
    `  RB ${report.before.RB} → ${report.after.RB}`,
    `  FB ${report.before.FB} → ${report.after.FB}`,
    `  WR ${report.before.WR} → ${report.after.WR}`,
    `  TE ${report.before.TE} → ${report.after.TE}`,
    "",
    `Full formation viable before: ${report.formationBefore.fullFormationViable}/${report.formationBefore.combinations}`,
    `Full formation viable after:  ${report.formationAfter.fullFormationViable}/${report.formationAfter.combinations}`,
    `Combinations losing viability: ${report.formationAfter.lostViability.length}`,
    ...report.formationAfter.lostViability.map(
      (row) => `  ${row.abbreviation} ${row.era} (${row.franchise})`,
    ),
    "",
    "DAL 2000s watchlist:",
    ...report.dal2000s.flatMap((row) => [
      `  ${row.playerName}`,
      `    seasons=${row.seasons.join(",") || "none"} positions=${row.positions.join("/") || "none"}`,
      `    games=${row.games.map((value) => (value == null ? "NULL" : String(value))).join(",") || "none"}`,
      `    draftable ${row.previouslyDraftable} → ${row.draftableAfter}`,
      `    ${row.reason}`,
    ]),
  ].join("\n");
}
