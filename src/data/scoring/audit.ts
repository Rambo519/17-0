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
import {
  LINEUP_SLOTS,
  type LineupSlot,
  type NormalizedPosition,
  positionForSlot,
} from "@/lib/football/positions";
import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import type { GameScoringResult, LineupPickInput } from "@/lib/scoring/types";
import {
  ratingThresholdForProjectedWins,
} from "@/lib/scoring/winProjection";
import { toScoringResultView } from "@/lib/scoring/view";
import { createDrizzleScoringRepository } from "@/server/repository/drizzleScoringRepository";

const REPORTS_DIR = path.join(process.cwd(), "data", "reports");
const DISTRIBUTION_SAMPLE_SIZE = 800;
const DISTRIBUTION_SEED = 20260823;
const BEST_LINEUP_CANDIDATES_PER_SLOT = 12;

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
      { slot: "QB", playerName: "Don Horn", eraLabel: "1970s", position: "QB" },
      { slot: "RB1", playerName: "Barry Pryor", eraLabel: "1970s", position: "RB" },
      { slot: "RB2", playerName: "Cleo Miller", eraLabel: "1970s", position: "RB" },
      { slot: "WR1", playerName: "Mac Haik", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Cecil Turner", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Pete Lammons", eraLabel: "1970s", position: "TE" },
    ],
  },
  {
    name: "average-competitive",
    description: "Middle-of-league starters without peak legends",
    picks: [
      { slot: "QB", playerName: "Al Woodall", eraLabel: "1970s", position: "QB" },
      { slot: "RB1", playerName: "Johnny Hector", eraLabel: "1990s", position: "RB" },
      { slot: "RB2", playerName: "Earnest Byner", eraLabel: "1980s", position: "RB" },
      { slot: "WR1", playerName: "Jim Beirne", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Paul Flatley", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Rich Kotite", eraLabel: "1970s", position: "TE" },
    ],
  },
  {
    name: "solid-starters",
    description: "Competitive historical starters, not all-time peaks",
    picks: [
      { slot: "QB", playerName: "Dan Pastorini", eraLabel: "1970s", position: "QB" },
      { slot: "RB1", playerName: "Oscar Reed", eraLabel: "1970s", position: "RB" },
      { slot: "RB2", playerName: "Chuck Muncie", eraLabel: "1970s", position: "RB" },
      { slot: "WR1", playerName: "Lance Rentzel", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Larry Walton", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Billy Masters", eraLabel: "1970s", position: "TE" },
    ],
  },
  {
    name: "star-heavy",
    description: "Strong playoff-level mix of recognizable stars",
    picks: [
      { slot: "QB", playerName: "Terry Bradshaw", eraLabel: "1970s", position: "QB" },
      { slot: "RB1", playerName: "Rocky Bleier", eraLabel: "1970s", position: "RB" },
      { slot: "RB2", playerName: "Franco Harris", eraLabel: "1970s", position: "RB" },
      { slot: "WR1", playerName: "Charlie Joiner", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Ron Shanklin", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Bob Trumpy", eraLabel: "1970s", position: "TE" },
    ],
  },
  {
    name: "elite-legends",
    description: "Multiple era-defining players without stacking every all-time peak",
    picks: [
      { slot: "QB", playerName: "Roger Staubach", eraLabel: "1970s", position: "QB" },
      { slot: "RB1", playerName: "Ed Podolak", eraLabel: "1970s", position: "RB" },
      { slot: "RB2", playerName: "Thurman Thomas", eraLabel: "1990s", position: "RB" },
      { slot: "WR1", playerName: "Eddie Hinton", eraLabel: "1970s", position: "WR" },
      { slot: "WR2", playerName: "Bob Grim", eraLabel: "1970s", position: "WR" },
      { slot: "TE", playerName: "Milt Morin", eraLabel: "1970s", position: "TE" },
    ],
  },
  {
    name: "extreme-all-time",
    description: "Peak-era legends without hard-coded ratings",
    picks: [
      { slot: "QB", playerName: "Patrick Mahomes", eraLabel: "2020s", position: "QB" },
      { slot: "RB1", playerName: "LaDainian Tomlinson", eraLabel: "2000s", position: "RB" },
      { slot: "RB2", playerName: "Marshall Faulk", eraLabel: "2000s", position: "RB" },
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
  { playerName: "Walter Payton", eraLabel: "1970s", position: "RB", slot: "RB1" },
  { playerName: "Emmitt Smith", eraLabel: "1990s", position: "RB", slot: "RB1" },
  { playerName: "LaDainian Tomlinson", eraLabel: "2000s", position: "RB", slot: "RB1" },
  { playerName: "Adrian Peterson", eraLabel: "2010s", position: "RB", slot: "RB1" },
  { playerName: "Jerry Rice", eraLabel: "1980s", position: "WR", slot: "WR1" },
  { playerName: "Randy Moss", eraLabel: "2000s", position: "WR", slot: "WR1" },
  { playerName: "Calvin Johnson", eraLabel: "2010s", position: "WR", slot: "WR1" },
  { playerName: "Tyreek Hill", eraLabel: "2020s", position: "WR", slot: "WR1" },
];

export interface DistributionAudit {
  sampleSize: number;
  seed: number;
  offenseRatingPercentiles: Record<string, number>;
  expectedWinsPercentiles: Record<string, number>;
  projectedWinBuckets: {
    wins0to8: number;
    wins9to10: number;
    wins11to12: number;
    wins13to14: number;
    wins15: number;
    wins16: number;
    wins17: number;
  };
}

export interface WinProjectionThresholds {
  projectedWins15ThresholdRating: number;
  projectedWins16ThresholdRating: number;
  projectedWins17ThresholdRating: number;
}

export interface BestLineupAudit {
  result: ReturnType<typeof toScoringResultView>;
  players: Array<{
    lineupSlot: LineupSlot;
    playerName: string;
    position: NormalizedPosition;
    scoringSeason: number | null;
    overall: number;
  }>;
}

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
    rawProductionScore: number | null;
    reliability: number | null;
    overall: number | null;
    percentileRank: number | null;
    dataConfidence: string | null;
  }>;
  distribution: DistributionAudit;
  winProjectionThresholds: WinProjectionThresholds;
  bestLineup: BestLineupAudit | null;
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower] ?? 0;
  const weight = index - lower;
  return (sorted[lower] ?? 0) * (1 - weight) + (sorted[upper] ?? 0) * weight;
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

async function loadCardPoolBySlot(db: Database): Promise<Map<LineupSlot, LineupPickInput[]>> {
  const repository = createDrizzleScoringRepository(db);
  const pool = new Map<LineupSlot, LineupPickInput[]>();

  for (const slot of LINEUP_SLOTS) {
    const position = positionForSlot(slot);
    const rows = await db
      .select({
        cardId: playerTeamEraCards.id,
        playerId: playerTeamEraCards.playerId,
        playerName: players.displayName,
        franchiseId: playerTeamEraCards.franchiseId,
        eraId: playerTeamEraCards.eraId,
        firstSeason: playerTeamEraCards.firstSeason,
        lastSeason: playerTeamEraCards.lastSeason,
      })
      .from(playerTeamEraCards)
      .innerJoin(players, eq(players.id, playerTeamEraCards.playerId))
      .innerJoin(
        playerTeamEraPositions,
        and(
          eq(playerTeamEraPositions.playerTeamEraCardId, playerTeamEraCards.id),
          eq(playerTeamEraPositions.position, position),
        ),
      )
      .where(eq(playerTeamEraCards.draftable, true));

    const cardIds = rows.map((row) => row.cardId);
    const seasonsByCard = await repository.loadSeasonStatsForCards(cardIds);
    const cards = await repository.findCards(cardIds);

    const picks: LineupPickInput[] = rows.map((row, index) => ({
      lineupSlot: slot,
      playerId: row.playerId,
      playerName: row.playerName,
      franchiseId: row.franchiseId,
      eraId: row.eraId,
      cardId: row.cardId,
      firstSeason: row.firstSeason,
      lastSeason: row.lastSeason,
      positions: cards[index]?.positions ?? [position],
      seasons: seasonsByCard.get(row.cardId) ?? [],
    }));

    pool.set(slot, picks);
  }

  return pool;
}

interface RankedSlotCandidate {
  pick: LineupPickInput;
  soloOverall: number;
}

async function rankCandidatesBySlot(
  pool: Map<LineupSlot, LineupPickInput[]>,
  baselines: ReturnType<typeof buildPeerBaselineIndex>,
): Promise<Map<LineupSlot, RankedSlotCandidate[]>> {
  const ranked = new Map<LineupSlot, RankedSlotCandidate[]>();

  for (const slot of LINEUP_SLOTS) {
    const candidates = pool.get(slot) ?? [];
    const scored: RankedSlotCandidate[] = [];

    for (const pick of candidates) {
      const evaluation = evaluateLineup([{ ...pick, lineupSlot: slot }], baselines);
      const player = evaluation.offense.players[0];
      if (!player) continue;
      scored.push({ pick: { ...pick, lineupSlot: slot }, soloOverall: player.overall });
    }

    scored.sort((a, b) => b.soloOverall - a.soloOverall);
    ranked.set(slot, scored.slice(0, BEST_LINEUP_CANDIDATES_PER_SLOT));
  }

  return ranked;
}

export async function findBestLineup(
  db: Database,
  baselines: ReturnType<typeof buildPeerBaselineIndex>,
): Promise<BestLineupAudit | null> {
  const pool = await loadCardPoolBySlot(db);
  const rankedBySlot = await rankCandidatesBySlot(pool, baselines);

  let bestResult: GameScoringResult | null = null;
  let bestPicks: LineupPickInput[] | null = null;

  function search(slotIndex: number, picks: LineupPickInput[], usedPlayerIds: Set<number>): void {
    if (slotIndex >= LINEUP_SLOTS.length) {
      const result = evaluateLineup(picks, baselines);
      if (!bestResult || result.offense.overallRating > bestResult.offense.overallRating) {
        bestResult = result;
        bestPicks = [...picks];
      }
      return;
    }

    const slot = LINEUP_SLOTS[slotIndex]!;
    const candidates = rankedBySlot.get(slot) ?? [];

    for (const candidate of candidates) {
      if (usedPlayerIds.has(candidate.pick.playerId)) continue;
      usedPlayerIds.add(candidate.pick.playerId);
      picks.push(candidate.pick);
      search(slotIndex + 1, picks, usedPlayerIds);
      picks.pop();
      usedPlayerIds.delete(candidate.pick.playerId);
    }
  }

  search(0, [], new Set<number>());

  if (!bestResult || !bestPicks) return null;

  const view = toScoringResultView(bestResult);
  return {
    result: view,
    players: view.players.map((player) => ({
      lineupSlot: player.lineupSlot as LineupSlot,
      playerName: player.playerName,
      position: player.position as NormalizedPosition,
      scoringSeason: player.scoringSeason,
      overall: player.overall,
    })),
  };
}

export function computeWinProjectionThresholds(): WinProjectionThresholds {
  return {
    projectedWins15ThresholdRating: ratingThresholdForProjectedWins(15),
    projectedWins16ThresholdRating: ratingThresholdForProjectedWins(16),
    projectedWins17ThresholdRating: ratingThresholdForProjectedWins(17),
  };
}

export async function runDistributionAudit(
  db: Database,
  baselines: ReturnType<typeof buildPeerBaselineIndex>,
  sampleSize = DISTRIBUTION_SAMPLE_SIZE,
  seed = DISTRIBUTION_SEED,
): Promise<DistributionAudit> {
  const pool = await loadCardPoolBySlot(db);
  const rng = mulberry32(seed);
  const offenseRatings: number[] = [];
  const expectedWins: number[] = [];
  const projectedWins: number[] = [];

  for (let i = 0; i < sampleSize; i += 1) {
    const picks: LineupPickInput[] = [];
    const usedPlayerIds = new Set<number>();

    for (const slot of LINEUP_SLOTS) {
      const candidates = pool.get(slot) ?? [];
      if (candidates.length === 0) continue;

      let chosen: LineupPickInput | null = null;
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const candidate = candidates[Math.floor(rng() * candidates.length)]!;
        if (!usedPlayerIds.has(candidate.playerId)) {
          chosen = candidate;
          break;
        }
      }
      if (!chosen) {
        chosen = candidates[Math.floor(rng() * candidates.length)]!;
      }
      usedPlayerIds.add(chosen.playerId);
      picks.push({ ...chosen, lineupSlot: slot });
    }

    if (picks.length !== LINEUP_SLOTS.length) continue;

    const result = evaluateLineup(picks, baselines);
    offenseRatings.push(result.offense.overallRating);
    expectedWins.push(result.projection.expectedWins);
    projectedWins.push(result.projection.projectedWins);
  }

  const sortedRatings = [...offenseRatings].sort((a, b) => a - b);
  const sortedWins = [...expectedWins].sort((a, b) => a - b);

  const buckets = {
    wins0to8: 0,
    wins9to10: 0,
    wins11to12: 0,
    wins13to14: 0,
    wins15: 0,
    wins16: 0,
    wins17: 0,
  };

  for (const wins of projectedWins) {
    if (wins <= 8) buckets.wins0to8 += 1;
    else if (wins <= 10) buckets.wins9to10 += 1;
    else if (wins <= 12) buckets.wins11to12 += 1;
    else if (wins <= 14) buckets.wins13to14 += 1;
    else if (wins === 15) buckets.wins15 += 1;
    else if (wins === 16) buckets.wins16 += 1;
    else buckets.wins17 += 1;
  }

  const total = projectedWins.length || 1;

  return {
    sampleSize: projectedWins.length,
    seed,
    offenseRatingPercentiles: {
      p10: percentile(sortedRatings, 0.1),
      p25: percentile(sortedRatings, 0.25),
      p50: percentile(sortedRatings, 0.5),
      p75: percentile(sortedRatings, 0.75),
      p90: percentile(sortedRatings, 0.9),
      p95: percentile(sortedRatings, 0.95),
      p99: percentile(sortedRatings, 0.99),
    },
    expectedWinsPercentiles: {
      p10: percentile(sortedWins, 0.1),
      p25: percentile(sortedWins, 0.25),
      p50: percentile(sortedWins, 0.5),
      p75: percentile(sortedWins, 0.75),
      p90: percentile(sortedWins, 0.9),
      p95: percentile(sortedWins, 0.95),
      p99: percentile(sortedWins, 0.99),
    },
    projectedWinBuckets: {
      wins0to8: buckets.wins0to8 / total,
      wins9to10: buckets.wins9to10 / total,
      wins11to12: buckets.wins11to12 / total,
      wins13to14: buckets.wins13to14 / total,
      wins15: buckets.wins15 / total,
      wins16: buckets.wins16 / total,
      wins17: buckets.wins17 / total,
    },
  };
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
            projectedLosses: REGULAR_SEASON_GAMES,
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
        rawProductionScore: null,
        reliability: null,
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
      rawProductionScore: evaluation?.rawProductionScore ?? null,
      reliability: evaluation?.reliability ?? null,
      overall: evaluation?.overall ?? null,
      percentileRank: evaluation?.percentileRank ?? null,
      dataConfidence: evaluation?.dataConfidence ?? null,
    });
  }

  const distribution = await runDistributionAudit(db, baselines);
  const winProjectionThresholds = computeWinProjectionThresholds();
  const bestLineup = await findBestLineup(db, baselines);

  return {
    generatedAt: new Date().toISOString(),
    diagnosticLineups,
    fairnessProbes,
    distribution,
    winProjectionThresholds,
    bestLineup,
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
      `  weighted talent: ${lineup.result.weightedTalentRating.toFixed(1)}`,
      `  balance adjustment: ${lineup.result.balanceAdjustment.toFixed(2)}`,
      `  offense rating: ${lineup.result.offenseRating.toFixed(1)}`,
      `  expected wins: ${lineup.result.expectedWins.toFixed(2)}`,
      `  projected: ${lineup.result.projectedWins}-${lineup.result.projectedLosses}`,
      `  per-game win prob: ${lineup.result.perGameWinProbability.toFixed(3)}`,
      `  17-0 prob: ${(lineup.result.perfectSeasonProbability * 100).toFixed(2)}%`,
      `  data confidence: ${lineup.result.dataConfidence}`,
      ...(lineup.missingCards.length > 0
        ? [`  missing: ${lineup.missingCards.join("; ")}`]
        : []),
      ...lineup.result.players.map(
        (player) =>
          `  ${player.lineupSlot} ${player.playerName} (${player.position}):` +
          ` season=${player.scoringSeason ?? "?"}` +
          ` raw=${player.rawProductionScore.toFixed(1)}` +
          ` rel=${player.reliability.toFixed(2)}` +
          ` final=${player.overall.toFixed(1)}` +
          ` pct=${player.percentileRank.toFixed(1)}` +
          ` conf=${player.dataConfidence}`,
      ),
    ]),
    "",
    "FAIRNESS PROBES (elite seasons across eras)",
    ...report.fairnessProbes.map(
      (probe) =>
        probe.found
          ? `${probe.playerName} ${probe.eraLabel} ${probe.position}: raw=${probe.rawProductionScore?.toFixed(1)} rel=${probe.reliability?.toFixed(2)} overall=${probe.overall?.toFixed(1)} pct=${probe.percentileRank?.toFixed(1)} season=${probe.scoringSeason}`
          : `${probe.playerName} ${probe.eraLabel}: NOT FOUND`,
    ),
    "",
    "WIN PROJECTION THRESHOLDS",
    `  offense rating for 15-2 projection: ${report.winProjectionThresholds.projectedWins15ThresholdRating.toFixed(2)}`,
    `  offense rating for 16-1 projection: ${report.winProjectionThresholds.projectedWins16ThresholdRating.toFixed(2)}`,
    `  offense rating for 17-0 projection: ${report.winProjectionThresholds.projectedWins17ThresholdRating.toFixed(2)}`,
    "",
    "BEST LEGITIMATE LINEUP",
    ...(report.bestLineup
      ? [
          `  offense rating: ${report.bestLineup.result.offenseRating.toFixed(1)}`,
          `  expected wins: ${report.bestLineup.result.expectedWins.toFixed(2)}`,
          `  projected: ${report.bestLineup.result.projectedWins}-${report.bestLineup.result.projectedLosses}`,
          `  per-game win prob: ${report.bestLineup.result.perGameWinProbability.toFixed(3)}`,
          `  17-0 prob: ${(report.bestLineup.result.perfectSeasonProbability * 100).toFixed(2)}%`,
          ...report.bestLineup.players.map(
            (player) =>
              `  ${player.lineupSlot} ${player.playerName} (${player.position}):` +
              ` season=${player.scoringSeason ?? "?"}` +
              ` rating=${player.overall.toFixed(1)}`,
          ),
        ]
      : ["  NOT FOUND"]),
    "",
    "DISTRIBUTION AUDIT",
    `  sample size: ${report.distribution.sampleSize} (seed ${report.distribution.seed})`,
    `  offense rating P10/P25/P50/P75/P90/P95/P99: ${Object.values(report.distribution.offenseRatingPercentiles).map((v) => v.toFixed(1)).join(" / ")}`,
    `  expected wins P10/P25/P50/P75/P90/P95/P99: ${Object.values(report.distribution.expectedWinsPercentiles).map((v) => v.toFixed(2)).join(" / ")}`,
    `  projected win buckets:`,
    `    0-8: ${(report.distribution.projectedWinBuckets.wins0to8 * 100).toFixed(1)}%`,
    `    9-10: ${(report.distribution.projectedWinBuckets.wins9to10 * 100).toFixed(1)}%`,
    `    11-12: ${(report.distribution.projectedWinBuckets.wins11to12 * 100).toFixed(1)}%`,
    `    13-14: ${(report.distribution.projectedWinBuckets.wins13to14 * 100).toFixed(1)}%`,
    `    15: ${(report.distribution.projectedWinBuckets.wins15 * 100).toFixed(1)}%`,
    `    16: ${(report.distribution.projectedWinBuckets.wins16 * 100).toFixed(1)}%`,
    `    17: ${(report.distribution.projectedWinBuckets.wins17 * 100).toFixed(1)}%`,
  ];

  await writeFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
  return { jsonPath, summaryPath };
}
