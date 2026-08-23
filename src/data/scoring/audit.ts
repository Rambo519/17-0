import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { and, eq } from "drizzle-orm";

import type { Database } from "@/db/client";
import {
  eras,
  franchises,
  players,
  playerTeamEraCards,
  playerTeamEraPositions,
} from "@/db/schema";
import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import type { GameScoringResult, LineupPickInput } from "@/lib/scoring/types";
import { toScoringResultView } from "@/lib/scoring/view";
import { createDrizzleScoringRepository } from "@/server/repository/drizzleScoringRepository";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

export interface DiagnosticLineupSpec {
  name: string;
  description: string;
  picks: Array<{
    slot: LineupSlot;
    playerName: string;
    eraLabel: string;
    franchiseSlug?: string;
    position: NormalizedPosition;
  }>;
}

export const DIAGNOSTIC_LINEUPS: DiagnosticLineupSpec[] = [
  {
    name: "weak-fringe",
    description: "Deliberately weak fringe contributors across eras",
    picks: [
      { slot: "QB", playerName: "Jim Zorn", eraLabel: "1970s", position: "QB" },
      { slot: "RB", playerName: "Rocky Bleier", eraLabel: "1970s", position: "RB" },
      { slot: "FB", playerName: "Tom Rathman", eraLabel: "1980s", position: "FB" },
      { slot: "WR1", playerName: "Harold Jackson", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Gene Washington", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Pete Metzelaars", eraLabel: "1990s", position: "TE" },
    ],
  },
  {
    name: "solid-starters",
    description: "Competitive historical starters, not all-time peaks",
    picks: [
      { slot: "QB", playerName: "Terry Bradshaw", eraLabel: "1970s", position: "QB" },
      { slot: "RB", playerName: "Curtis Martin", eraLabel: "2000s", position: "RB" },
      { slot: "FB", playerName: "Mike Alstott", eraLabel: "2000s", position: "FB" },
      { slot: "WR1", playerName: "Andre Rison", eraLabel: "1990s", position: "WR" },
      { slot: "WR2", playerName: "Torry Holt", eraLabel: "2000s", position: "WR" },
      { slot: "TE", playerName: "Mark Bavaro", eraLabel: "1980s", position: "TE" },
    ],
  },
  {
    name: "star-heavy",
    description: "Strong playoff-level mix of recognizable stars",
    picks: [
      { slot: "QB", playerName: "Peyton Manning", eraLabel: "2000s", position: "QB" },
      { slot: "RB", playerName: "Emmitt Smith", eraLabel: "1990s", position: "RB" },
      { slot: "FB", playerName: "Larry Centers", eraLabel: "1990s", position: "FB" },
      { slot: "WR1", playerName: "Jerry Rice", eraLabel: "1990s", position: "WR" },
      { slot: "WR2", playerName: "Randy Moss", eraLabel: "2000s", position: "WR" },
      { slot: "TE", playerName: "Tony Gonzalez", eraLabel: "2000s", position: "TE" },
    ],
  },
  {
    name: "extreme-all-time",
    description: "Peak-era legends without hard-coded ratings",
    picks: [
      { slot: "QB", playerName: "Patrick Mahomes", eraLabel: "2020s", position: "QB" },
      { slot: "RB", playerName: "LaDainian Tomlinson", eraLabel: "2000s", position: "RB" },
      { slot: "FB", playerName: "Larry Centers", eraLabel: "1990s", position: "FB" },
      { slot: "WR1", playerName: "Jerry Rice", eraLabel: "1980s", position: "WR" },
      { slot: "WR2", playerName: "Calvin Johnson", eraLabel: "2010s", position: "WR" },
      { slot: "TE", playerName: "Rob Gronkowski", eraLabel: "2010s", position: "TE" },
    ],
  },
];

export const FAIRNESS_PROBE_PLAYERS: Array<{
  playerName: string;
  eraLabel: string;
  position: NormalizedPosition;
  slot: LineupSlot;
}> = [
  { playerName: "Terry Bradshaw", eraLabel: "1970s", position: "QB", slot: "QB" },
  { playerName: "Joe Montana", eraLabel: "1980s", position: "QB", slot: "QB" },
  { playerName: "Dan Marino", eraLabel: "1990s", position: "QB", slot: "QB" },
  { playerName: "Peyton Manning", eraLabel: "2000s", position: "QB", slot: "QB" },
  { playerName: "Tom Brady", eraLabel: "2010s", position: "QB", slot: "QB" },
  { playerName: "Patrick Mahomes", eraLabel: "2020s", position: "QB", slot: "QB" },
  { playerName: "Walter Payton", eraLabel: "1970s", position: "RB", slot: "RB" },
  { playerName: "Emmitt Smith", eraLabel: "1990s", position: "RB", slot: "RB" },
  { playerName: "LaDainian Tomlinson", eraLabel: "2000s", position: "RB", slot: "RB" },
  { playerName: "Adrian Peterson", eraLabel: "2010s", position: "RB", slot: "RB" },
  { playerName: "Jerry Rice", eraLabel: "1980s", position: "WR", slot: "WR1" },
  { playerName: "Randy Moss", eraLabel: "2000s", position: "WR", slot: "WR1" },
  { playerName: "Calvin Johnson", eraLabel: "2010s", position: "WR", slot: "WR1" },
  { playerName: "Tyreek Hill", eraLabel: "2020s", position: "WR", slot: "WR1" },
];

export interface ScoringAuditReport {
  generatedAt: string;
  diagnosticLineups: Array<{
    name: string;
    description: string;
    result: ReturnType<typeof toScoringResultView>;
    missingCards: string[];
  }>;
  fairnessProbes: Array<{
    playerName: string;
    eraLabel: string;
    position: NormalizedPosition;
    found: boolean;
    scoringSeason: number | null;
    overall: number | null;
    percentileRank: number | null;
    dataConfidence: string | null;
  }>;
}

async function findCard(
  db: Database,
  playerName: string,
  eraLabel: string,
  position: NormalizedPosition,
  franchiseSlug?: string,
): Promise<{ cardId: number; playerId: number; franchiseId: number; eraId: number } | null> {
  const conditions = [
    eq(players.displayName, playerName),
    eq(eras.label, eraLabel),
    eq(playerTeamEraCards.draftable, true),
    eq(playerTeamEraPositions.position, position),
  ];
  if (franchiseSlug) {
    conditions.push(eq(franchises.slug, franchiseSlug));
  }

  const rows = await db
    .select({
      cardId: playerTeamEraCards.id,
      playerId: playerTeamEraCards.playerId,
      franchiseId: playerTeamEraCards.franchiseId,
      eraId: playerTeamEraCards.eraId,
    })
    .from(playerTeamEraCards)
    .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
    .innerJoin(eras, eq(eras.id, playerTeamEraCards.eraId))
    .innerJoin(franchises, eq(franchises.id, playerTeamEraCards.franchiseId))
    .innerJoin(
      playerTeamEraPositions,
      and(
        eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
        eq(playerTeamEraPositions.position, position),
      ),
    )
    .where(and(...conditions))
    .limit(1);

  return rows[0] ?? null;
}

async function buildLineupInput(
  db: Database,
  spec: DiagnosticLineupSpec,
): Promise<{ picks: LineupPickInput[]; missing: string[] }> {
  const repository = createDrizzleScoringRepository(db);
  const picks: LineupPickInput[] = [];
  const missing: string[] = [];

  for (const entry of spec.picks) {
    const card = await findCard(
      db,
      entry.playerName,
      entry.eraLabel,
      entry.position,
      entry.franchiseSlug,
    );
    if (!card) {
      missing.push(`${entry.slot}: ${entry.playerName} (${entry.eraLabel})`);
      continue;
    }

    const fullCard = await repository.findCard(card.cardId);
    if (!fullCard) {
      missing.push(`${entry.slot}: ${entry.playerName} (card load failed)`);
      continue;
    }

    const seasonsByCard = await repository.loadSeasonStatsForCards([card.cardId]);
    picks.push({
      lineupSlot: entry.slot,
      playerId: card.playerId,
      playerName: entry.playerName,
      franchiseId: card.franchiseId,
      eraId: card.eraId,
      cardId: card.cardId,
      firstSeason: fullCard.firstSeason,
      lastSeason: fullCard.lastSeason,
      positions: fullCard.positions,
      seasons: seasonsByCard.get(card.cardId) ?? [],
    });
  }

  return { picks, missing };
}

export async function runScoringAudit(db: Database): Promise<ScoringAuditReport> {
  const repository = createDrizzleScoringRepository(db);
  const peerSeasons = await repository.loadAllSeasonStatsForPeers();
  const baselines = buildPeerBaselineIndex(peerSeasons);

  const diagnosticLineups: ScoringAuditReport["diagnosticLineups"] = [];

  for (const spec of DIAGNOSTIC_LINEUPS) {
    const { picks, missing } = await buildLineupInput(db, spec);
    let result: GameScoringResult | null = null;
    if (picks.length === 6) {
      result = evaluateLineup(picks, baselines);
    }
    diagnosticLineups.push({
      name: spec.name,
      description: spec.description,
      result: result
        ? toScoringResultView(result)
        : {
            offenseRating: 0,
            weightedTalentRating: 0,
            balanceAdjustment: 0,
            expectedWins: 0,
            projectedWins: 0,
            projectedLosses: 16,
            perGameWinProbability: 0,
            perfectSeasonProbability: 0,
            dataConfidence: "LOW",
            players: [],
          },
      missingCards: missing,
    });
  }

  const fairnessProbes: ScoringAuditReport["fairnessProbes"] = [];

  for (const probe of FAIRNESS_PROBE_PLAYERS) {
    const card = await findCard(db, probe.playerName, probe.eraLabel, probe.position);
    if (!card) {
      fairnessProbes.push({
        playerName: probe.playerName,
        eraLabel: probe.eraLabel,
        position: probe.position,
        found: false,
        scoringSeason: null,
        overall: null,
        percentileRank: null,
        dataConfidence: null,
      });
      continue;
    }

    const fullCard = await repository.findCard(card.cardId);
    const seasonsByCard = await repository.loadSeasonStatsForCards([card.cardId]);
    const pick: LineupPickInput = {
      lineupSlot: probe.slot,
      playerId: card.playerId,
      playerName: probe.playerName,
      franchiseId: card.franchiseId,
      eraId: card.eraId,
      cardId: card.cardId,
      firstSeason: fullCard?.firstSeason ?? 0,
      lastSeason: fullCard?.lastSeason ?? 0,
      positions: fullCard?.positions ?? [probe.position],
      seasons: seasonsByCard.get(card.cardId) ?? [],
    };

    const evaluation = evaluateLineup([pick], baselines).offense.players[0];

    fairnessProbes.push({
      playerName: probe.playerName,
      eraLabel: probe.eraLabel,
      position: probe.position,
      found: true,
      scoringSeason: evaluation?.scoringSeason ?? null,
      overall: evaluation?.overall ?? null,
      percentileRank: evaluation?.percentileRank ?? null,
      dataConfidence: evaluation?.dataConfidence ?? null,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    diagnosticLineups,
    fairnessProbes,
  };
}

export async function writeScoringAuditReports(report: ScoringAuditReport): Promise<{
  jsonPath: string;
  summaryPath: string;
}> {
  await mkdir(REPORTS_DIR, { recursive: true });
  const jsonPath = path.join(REPORTS_DIR, "scoring-audit.json");
  const summaryPath = path.join(REPORTS_DIR, "scoring-audit-summary.txt");

  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  const lines = [
    `Scoring audit @ ${report.generatedAt}`,
    "",
    "DIAGNOSTIC LINEUPS",
    ...report.diagnosticLineups.flatMap((lineup) => [
      "",
      `${lineup.name}: ${lineup.description}`,
      `  offense rating: ${lineup.result.offenseRating.toFixed(1)}`,
      `  expected wins: ${lineup.result.expectedWins.toFixed(2)}`,
      `  projected: ${lineup.result.projectedWins}-${lineup.result.projectedLosses}`,
      `  per-game win prob: ${lineup.result.perGameWinProbability.toFixed(3)}`,
      `  16-0 prob: ${(lineup.result.perfectSeasonProbability * 100).toFixed(2)}%`,
      `  data confidence: ${lineup.result.dataConfidence}`,
      ...(lineup.missingCards.length > 0
        ? [`  missing: ${lineup.missingCards.join("; ")}`]
        : []),
      ...lineup.result.players.map(
        (player) =>
          `  ${player.lineupSlot} ${player.playerName}: ${player.overall.toFixed(1)}` +
          ` (season ${player.scoringSeason ?? "?"}, pct ${player.percentileRank.toFixed(1)})`,
      ),
    ]),
    "",
    "FAIRNESS PROBES (elite seasons across eras)",
    ...report.fairnessProbes.map(
      (probe) =>
        probe.found
          ? `${probe.playerName} ${probe.eraLabel} ${probe.position}: overall=${probe.overall?.toFixed(1)} pct=${probe.percentileRank?.toFixed(1)} season=${probe.scoringSeason}`
          : `${probe.playerName} ${probe.eraLabel}: NOT FOUND`,
    ),
  ];

  await writeFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, summaryPath };
}
