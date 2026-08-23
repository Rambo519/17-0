import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  franchiseSeasons,
  players,
  playerSeasons,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import type { NormalizedPosition } from "@/lib/football/positions";
import { NORMALIZED_POSITIONS } from "@/lib/football/positions";
import { PLAYABLE_ERA_LABELS } from "@/lib/football/eras";

export interface FranchiseEraCoverageRow {
  franchise: string;
  franchiseSlug: string;
  era: string;
  seasonsPresent: number;
  qbCount: number;
  rbCount: number;
  fbCount: number;
  wrCount: number;
  teCount: number;
  totalSkillPlayers: number;
  fullFormationViable: boolean;
}

export interface EraProductionCoverageRow {
  era: string;
  draftableCards: number;
  cardsWithPassingProduction: number;
  cardsWithRushingProduction: number;
  cardsWithReceivingProduction: number;
  cardsWithAnyProduction: number;
  cardsWithNoProduction: number;
  productionCoveragePercent: number;
}

export interface CoverageAuditReport {
  generatedAt: string;
  franchiseEraRows: FranchiseEraCoverageRow[];
  productionByEra: EraProductionCoverageRow[];
  summary: {
    franchiseEraCombinations: number;
    fullFormationViable: number;
    zeroQb: number;
    zeroRb: number;
    zeroFb: number;
    fewerThanTwoWr: number;
    zeroTe: number;
  };
  fullbackCoverage: {
    zeroFb: number;
    oneFb: number;
    twoOrMoreFb: number;
  };
  gaps: {
    zeroQb: FranchiseEraCoverageRow[];
    zeroRb: FranchiseEraCoverageRow[];
    zeroFb: FranchiseEraCoverageRow[];
    fewerThanTwoWr: FranchiseEraCoverageRow[];
    zeroTe: FranchiseEraCoverageRow[];
  };
  unmappedRawPositions: { rawPosition: string; count: number }[];
  cardsWithNoPositions: number;
  duplicateGsisIds: number;
  duplicatePlayerTeamSeason: number;
  players: number;
  playerSeasons: number;
  cards: number;
  draftableCards: number;
  franchises: number;
}

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");
const KNOWN_ALIASES = new Set(["HB", "TB", "FL", "SE", ...NORMALIZED_POSITIONS]);

function hasPosition(positions: readonly NormalizedPosition[], target: NormalizedPosition): number {
  return positions.includes(target) ? 1 : 0;
}

export async function runCoverageAudit(db: Database): Promise<CoverageAuditReport> {
  const franchiseRows = await db.select().from(franchises);
  const eraRows = await db
    .select()
    .from(eras)
    .where(inArray(eras.label, [...PLAYABLE_ERA_LABELS]));
  const franchiseSeasonRows = await db.select().from(franchiseSeasons);

  const seasonsByFranchise = new Map<number, Set<number>>();
  for (const row of franchiseSeasonRows) {
    const set = seasonsByFranchise.get(row.franchiseId) ?? new Set<number>();
    set.add(row.season);
    seasonsByFranchise.set(row.franchiseId, set);
  }

  const cardRows = await db
    .select({
      cardId: playerTeamEraCards.id,
      franchiseId: playerTeamEraCards.franchiseId,
      eraId: playerTeamEraCards.eraId,
    })
    .from(playerTeamEraCards)
    .where(eq(playerTeamEraCards.draftable, true));

  const positionRows = await db.select().from(playerTeamEraPositions);
  const positionsByCard = new Map<number, NormalizedPosition[]>();
  for (const row of positionRows) {
    const list = positionsByCard.get(row.playerTeamEraCardId) ?? [];
    list.push(row.position);
    positionsByCard.set(row.playerTeamEraCardId, list);
  }

  const cardsByFranchiseEra = new Map<string, NormalizedPosition[][]>();
  for (const card of cardRows) {
    const key = `${card.franchiseId}|${card.eraId}`;
    const list = cardsByFranchiseEra.get(key) ?? [];
    list.push(positionsByCard.get(card.cardId) ?? []);
    cardsByFranchiseEra.set(key, list);
  }

  const franchiseEraRows: FranchiseEraCoverageRow[] = [];

  for (const franchise of franchiseRows) {
    for (const era of eraRows) {
      const seasonSet = seasonsByFranchise.get(franchise.id) ?? new Set<number>();
      let seasonsPresent = 0;
      for (const season of seasonSet) {
        if (season >= era.startYear && season <= era.endYear) seasonsPresent += 1;
      }
      if (seasonsPresent === 0) continue;

      const cardPositions = cardsByFranchiseEra.get(`${franchise.id}|${era.id}`) ?? [];
      let qb = 0;
      let rb = 0;
      let fb = 0;
      let wr = 0;
      let te = 0;
      for (const positions of cardPositions) {
        qb += hasPosition(positions, "QB");
        rb += hasPosition(positions, "RB");
        fb += hasPosition(positions, "FB");
        wr += hasPosition(positions, "WR");
        te += hasPosition(positions, "TE");
      }

      franchiseEraRows.push({
        franchise: franchise.canonicalName,
        franchiseSlug: franchise.slug,
        era: era.label,
        seasonsPresent,
        qbCount: qb,
        rbCount: rb,
        fbCount: fb,
        wrCount: wr,
        teCount: te,
        totalSkillPlayers: cardPositions.length,
        fullFormationViable: qb >= 1 && rb >= 1 && fb >= 1 && wr >= 2 && te >= 1,
      });
    }
  }

  franchiseEraRows.sort((a, b) =>
    a.era === b.era ? a.franchise.localeCompare(b.franchise) : a.era.localeCompare(b.era),
  );

  const zeroQb = franchiseEraRows.filter((row) => row.qbCount === 0);
  const zeroRb = franchiseEraRows.filter((row) => row.rbCount === 0);
  const zeroFb = franchiseEraRows.filter((row) => row.fbCount === 0);
  const fewerThanTwoWr = franchiseEraRows.filter((row) => row.wrCount < 2);
  const zeroTe = franchiseEraRows.filter((row) => row.teCount === 0);

  const rawPositionCounts = await db
    .select({
      rawPosition: playerSeasons.rawPosition,
      count: sql<number>`count(*)::int`,
    })
    .from(playerSeasons)
    .groupBy(playerSeasons.rawPosition);

  const unmappedRawPositions = rawPositionCounts
    .filter((row) => !KNOWN_ALIASES.has(row.rawPosition.toUpperCase()))
    .map((row) => ({ rawPosition: row.rawPosition, count: Number(row.count) }))
    .sort((a, b) => b.count - a.count);

  const allCards = await db.select({ id: playerTeamEraCards.id }).from(playerTeamEraCards);
  let cardsWithNoPositions = 0;
  for (const card of allCards) {
    if ((positionsByCard.get(card.id) ?? []).length === 0) cardsWithNoPositions += 1;
  }

  const gsisRows = await db
    .select({ gsisId: players.gsisId, count: sql<number>`count(*)::int` })
    .from(players)
    .groupBy(players.gsisId);
  const duplicateGsisIds = gsisRows.filter(
    (row) => row.gsisId != null && Number(row.count) > 1,
  ).length;

  const seasonDupRows = await db
    .select({
      playerId: playerSeasons.playerId,
      franchiseId: playerSeasons.franchiseId,
      season: playerSeasons.season,
      count: sql<number>`count(*)::int`,
    })
    .from(playerSeasons)
    .groupBy(playerSeasons.playerId, playerSeasons.franchiseId, playerSeasons.season);
  const duplicatePlayerTeamSeason = seasonDupRows.filter((row) => Number(row.count) > 1).length;

  const [playerCount] = await db.select({ count: sql<number>`count(*)::int` }).from(players);
  const [seasonCount] = await db.select({ count: sql<number>`count(*)::int` }).from(playerSeasons);
  const [cardCount] = await db.select({ count: sql<number>`count(*)::int` }).from(playerTeamEraCards);
  const [draftableCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(playerTeamEraCards)
    .where(eq(playerTeamEraCards.draftable, true));

  const productionByEra = await buildProductionCoverageByEra(db);

  return {
    generatedAt: new Date().toISOString(),
    franchiseEraRows,
    productionByEra,
    summary: {
      franchiseEraCombinations: franchiseEraRows.length,
      fullFormationViable: franchiseEraRows.filter((row) => row.fullFormationViable).length,
      zeroQb: zeroQb.length,
      zeroRb: zeroRb.length,
      zeroFb: zeroFb.length,
      fewerThanTwoWr: fewerThanTwoWr.length,
      zeroTe: zeroTe.length,
    },
    fullbackCoverage: {
      zeroFb: zeroFb.length,
      oneFb: franchiseEraRows.filter((row) => row.fbCount === 1).length,
      twoOrMoreFb: franchiseEraRows.filter((row) => row.fbCount >= 2).length,
    },
    gaps: { zeroQb, zeroRb, zeroFb, fewerThanTwoWr, zeroTe },
    unmappedRawPositions,
    cardsWithNoPositions,
    duplicateGsisIds,
    duplicatePlayerTeamSeason,
    players: Number(playerCount?.count ?? 0),
    playerSeasons: Number(seasonCount?.count ?? 0),
    cards: Number(cardCount?.count ?? 0),
    draftableCards: Number(draftableCount?.count ?? 0),
    franchises: franchiseRows.length,
  };
}

export async function writeCoverageAuditReports(
  report: CoverageAuditReport,
): Promise<{ jsonPath: string; csvPath: string; summaryPath: string }> {
  await mkdir(REPORTS_DIR, { recursive: true });

  const jsonPath = path.join(REPORTS_DIR, "coverage-audit.json");
  const csvPath = path.join(REPORTS_DIR, "coverage-audit.csv");
  const summaryPath = path.join(REPORTS_DIR, "coverage-audit-summary.txt");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const header = [
    "franchise",
    "era",
    "seasons_present",
    "qb_count",
    "rb_count",
    "fb_count",
    "wr_count",
    "te_count",
    "total_skill_players",
    "full_formation_viable",
  ];
  const lines = [
    header.join(","),
    ...report.franchiseEraRows.map((row) =>
      [
        csvEscape(row.franchise),
        row.era,
        row.seasonsPresent,
        row.qbCount,
        row.rbCount,
        row.fbCount,
        row.wrCount,
        row.teCount,
        row.totalSkillPlayers,
        row.fullFormationViable,
      ].join(","),
    ),
  ];
  await writeFile(csvPath, `${lines.join("\n")}\n`, "utf8");

  const productionSummaryPath = path.join(REPORTS_DIR, "production-coverage-by-era.txt");
  const productionLines = [
    `Production coverage by era @ ${report.generatedAt}`,
    "",
    ...report.productionByEra.map(
      (row) =>
        `${row.era}: ${row.productionCoveragePercent}% production coverage` +
        ` (draftable=${row.draftableCards}` +
        ` pass=${row.cardsWithPassingProduction}` +
        ` rush=${row.cardsWithRushingProduction}` +
        ` rec=${row.cardsWithReceivingProduction}` +
        ` none=${row.cardsWithNoProduction})`,
    ),
  ];
  await writeFile(productionSummaryPath, `${productionLines.join("\n")}\n`, "utf8");

  const summary = [
    `Coverage audit @ ${report.generatedAt}`,
    "",
    `Franchises: ${report.franchises}`,
    `Players: ${report.players}`,
    `Player-seasons: ${report.playerSeasons}`,
    `Cards: ${report.cards} (draftable ${report.draftableCards})`,
    `Franchise-era combinations: ${report.summary.franchiseEraCombinations}`,
    `Full-formation viable: ${report.summary.fullFormationViable}`,
    "",
    "PRODUCTION COVERAGE BY ERA",
    ...report.productionByEra.map(
      (row) => `  ${row.era}: ${row.productionCoveragePercent}%`,
    ),
    "",
    "FULLBACK COVERAGE",
    `  0 FB:  ${report.fullbackCoverage.zeroFb}`,
    `  1 FB:  ${report.fullbackCoverage.oneFb}`,
    `  2+ FB: ${report.fullbackCoverage.twoOrMoreFb}`,
    "",
    "Other gaps (franchise-era counts)",
    `  zero QB: ${report.summary.zeroQb}`,
    `  zero RB: ${report.summary.zeroRb}`,
    `  <2 WR:   ${report.summary.fewerThanTwoWr}`,
    `  zero TE: ${report.summary.zeroTe}`,
    "",
    `Cards with no positions: ${report.cardsWithNoPositions}`,
    `Duplicate GSIS ids: ${report.duplicateGsisIds}`,
    `Duplicate player/team/season rows: ${report.duplicatePlayerTeamSeason}`,
    "",
    "Top unmapped / non-alias raw positions:",
    ...report.unmappedRawPositions
      .slice(0, 25)
      .map((row) => `  ${row.rawPosition}: ${row.count}`),
    "",
    `Detailed JSON: ${jsonPath}`,
    `Detailed CSV:  ${csvPath}`,
    `Production by era: ${productionSummaryPath}`,
  ].join("\n");

  await writeFile(summaryPath, `${summary}\n`, "utf8");
  return { jsonPath, csvPath, summaryPath };
}

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"')) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

async function buildProductionCoverageByEra(db: Database): Promise<EraProductionCoverageRow[]> {
  const rows = await db
    .select({
      era: eras.label,
      cardId: playerTeamEraCards.id,
      passingYards: sql`sum(${playerSeasons.passingYards})`,
      passingTouchdowns: sql`sum(${playerSeasons.passingTouchdowns})`,
      rushingYards: sql`sum(${playerSeasons.rushingYards})`,
      rushingTouchdowns: sql`sum(${playerSeasons.rushingTouchdowns})`,
      receptions: sql`sum(${playerSeasons.receptions})`,
      receivingYards: sql`sum(${playerSeasons.receivingYards})`,
      receivingTouchdowns: sql`sum(${playerSeasons.receivingTouchdowns})`,
    })
    .from(playerTeamEraCards)
    .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
    .leftJoin(
      playerSeasons,
      and(
        eq(playerSeasons.playerId, playerTeamEraCards.playerId),
        eq(playerSeasons.franchiseId, playerTeamEraCards.franchiseId),
        sql`${playerSeasons.season} between ${playerTeamEraCards.firstSeason} and ${playerTeamEraCards.lastSeason}`,
      ),
    )
    .where(eq(playerTeamEraCards.draftable, true))
    .groupBy(eras.label, playerTeamEraCards.id);

  const byEra = new Map<
    string,
    {
      draftableCards: number;
      cardsWithPassingProduction: number;
      cardsWithRushingProduction: number;
      cardsWithReceivingProduction: number;
      cardsWithAnyProduction: number;
    }
  >();

  for (const row of rows) {
    const bucket = byEra.get(row.era) ?? {
      draftableCards: 0,
      cardsWithPassingProduction: 0,
      cardsWithRushingProduction: 0,
      cardsWithReceivingProduction: 0,
      cardsWithAnyProduction: 0,
    };
    bucket.draftableCards += 1;

    const pass = asNumber(row.passingYards) != null || asNumber(row.passingTouchdowns) != null;
    const rush = asNumber(row.rushingYards) != null || asNumber(row.rushingTouchdowns) != null;
    const rec =
      asNumber(row.receptions) != null ||
      asNumber(row.receivingYards) != null ||
      asNumber(row.receivingTouchdowns) != null;

    if (pass) bucket.cardsWithPassingProduction += 1;
    if (rush) bucket.cardsWithRushingProduction += 1;
    if (rec) bucket.cardsWithReceivingProduction += 1;
    if (pass || rush || rec) bucket.cardsWithAnyProduction += 1;
    byEra.set(row.era, bucket);
  }

  return [...byEra.entries()]
    .map(([era, bucket]) => {
      const cardsWithNoProduction = bucket.draftableCards - bucket.cardsWithAnyProduction;
      const productionCoveragePercent =
        bucket.draftableCards === 0
          ? 0
          : Math.round((1000 * bucket.cardsWithAnyProduction) / bucket.draftableCards) / 10;
      return {
        era,
        draftableCards: bucket.draftableCards,
        cardsWithPassingProduction: bucket.cardsWithPassingProduction,
        cardsWithRushingProduction: bucket.cardsWithRushingProduction,
        cardsWithReceivingProduction: bucket.cardsWithReceivingProduction,
        cardsWithAnyProduction: bucket.cardsWithAnyProduction,
        cardsWithNoProduction,
        productionCoveragePercent,
      };
    })
    .sort((a, b) => a.era.localeCompare(b.era));
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
