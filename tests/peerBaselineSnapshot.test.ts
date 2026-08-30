import { describe, expect, it } from "vitest";

import { evaluateCompletedGame } from "@/lib/scoring/evaluateGame";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { loadRuntimePeerBaselines } from "@/lib/scoring/loadPeerBaselines";
import {
  assertPeerBaselineSnapshot,
  createPeerBaselineSnapshot,
  peerBaselineIndexFromSnapshot,
  PeerBaselineSnapshotError,
} from "@/lib/scoring/peerBaselineSnapshot";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import type { GameScoringResult, LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";
import { projectWinsFromRating } from "@/lib/scoring/winProjection";
import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

import { createInMemoryScoringRepository } from "./helpers/inMemoryScoringRepository";
import { skipScenarioCards } from "./helpers/inMemoryGameRepository";

function season(
  overrides: Partial<SeasonStatRecord> & Pick<SeasonStatRecord, "season" | "playerId">,
): SeasonStatRecord {
  return {
    franchiseId: overrides.franchiseId ?? 1,
    positions: overrides.positions ?? ["QB"],
    games: overrides.games ?? 16,
    gamesStarted: overrides.gamesStarted ?? null,
    passingYards: overrides.passingYards ?? null,
    passingTouchdowns: overrides.passingTouchdowns ?? null,
    interceptions: overrides.interceptions ?? null,
    rushingYards: overrides.rushingYards ?? null,
    rushingAttempts: overrides.rushingAttempts ?? null,
    rushingTouchdowns: overrides.rushingTouchdowns ?? null,
    receptions: overrides.receptions ?? null,
    receivingYards: overrides.receivingYards ?? null,
    receivingTouchdowns: overrides.receivingTouchdowns ?? null,
    ...overrides,
  };
}

function buildSyntheticPeerCorpus(): SeasonStatRecord[] {
  const stats: SeasonStatRecord[] = [];
  for (let i = 0; i < 20; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 100 + i,
        positions: ["QB"],
        passingYards: 2000 + i * 150,
        passingTouchdowns: 10 + i,
        interceptions: 20 - i,
      }),
    );
  }
  for (let i = 0; i < 20; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 200 + i,
        positions: ["RB"],
        rushingYards: 600 + i * 80,
        rushingTouchdowns: 4 + i,
        receptions: 20 + i,
        receivingYards: 200 + i * 20,
      }),
    );
  }
  for (let i = 0; i < 8; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 300 + i,
        positions: ["FB"],
        rushingYards: 200 + i * 40,
        rushingTouchdowns: 1 + i,
        receptions: 15 + i,
        receivingYards: 150 + i * 25,
      }),
    );
  }
  for (let i = 0; i < 20; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 400 + i,
        positions: ["WR"],
        receivingYards: 500 + i * 60,
        receivingTouchdowns: 3 + i,
        receptions: 30 + i * 2,
      }),
    );
  }
  for (let i = 0; i < 15; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 500 + i,
        positions: ["TE"],
        receivingYards: 300 + i * 40,
        receivingTouchdowns: 2 + i,
        receptions: 25 + i,
      }),
    );
  }
  return stats;
}

function lineupPick(
  slot: LineupSlot,
  playerId: number,
  name: string,
  positions: NormalizedPosition[],
  seasons: SeasonStatRecord[],
): LineupPickInput {
  return {
    lineupSlot: slot,
    playerId,
    playerName: name,
    franchiseId: 1,
    eraId: 1,
    cardId: playerId,
    firstSeason: Math.min(...seasons.map((row) => row.season)),
    lastSeason: Math.max(...seasons.map((row) => row.season)),
    positions,
    seasons,
  };
}

function expectIdenticalScoring(left: GameScoringResult, right: GameScoringResult): void {
  expect(left.offense.overallRating).toBe(right.offense.overallRating);
  expect(left.offense.weightedTalentRating).toBe(right.offense.weightedTalentRating);
  expect(left.offense.balanceAdjustment).toBe(right.offense.balanceAdjustment);
  expect(left.offense.dataConfidence).toBe(right.offense.dataConfidence);
  expect(left.projection.expectedWins).toBe(right.projection.expectedWins);
  expect(left.projection.projectedWins).toBe(right.projection.projectedWins);
  expect(left.projection.projectedLosses).toBe(right.projection.projectedLosses);
  expect(left.projection.perGameWinProbability).toBe(right.projection.perGameWinProbability);
  expect(left.projection.perfectSeasonProbability).toBe(right.projection.perfectSeasonProbability);

  expect(left.offense.players).toHaveLength(right.offense.players.length);
  for (let i = 0; i < left.offense.players.length; i += 1) {
    const a = left.offense.players[i]!;
    const b = right.offense.players[i]!;
    expect(a.scoringSeason).toBe(b.scoringSeason);
    expect(a.overall).toBe(b.overall);
    expect(a.rawProductionScore).toBe(b.rawProductionScore);
    expect(a.reliability).toBe(b.reliability);
    expect(a.percentileRank).toBe(b.percentileRank);
    expect(a.dataConfidence).toBe(b.dataConfidence);
  }
}

function evaluateBothWays(peers: SeasonStatRecord[], picks: LineupPickInput[]) {
  const live = buildPeerBaselineIndex(peers);
  const snapshot = createPeerBaselineSnapshot(live, {
    playerSeasonCount: peers.length,
    seasonRange: { min: 1990, max: 1990 },
  });
  const restored = peerBaselineIndexFromSnapshot(JSON.parse(JSON.stringify(snapshot)));
  return {
    oldPath: evaluateLineup(picks, live),
    newPath: evaluateLineup(picks, restored),
  };
}

const weakLineup: LineupPickInput[] = [
  lineupPick("QB", 1, "Weak QB", ["QB"], [
    season({ season: 1990, playerId: 1, positions: ["QB"], passingYards: 2100, passingTouchdowns: 11, interceptions: 19 }),
  ]),
  lineupPick("RB", 2, "Weak RB", ["RB"], [
    season({ season: 1990, playerId: 2, positions: ["RB"], rushingYards: 620, rushingTouchdowns: 4, receptions: 21, receivingYards: 210 }),
  ]),
  lineupPick("FB", 3, "Weak FB", ["FB"], [
    season({ season: 1990, playerId: 3, positions: ["FB"], rushingYards: 210, rushingTouchdowns: 1, receptions: 16, receivingYards: 160 }),
  ]),
  lineupPick("WR1", 4, "Weak WR1", ["WR"], [
    season({ season: 1990, playerId: 4, positions: ["WR"], receivingYards: 520, receivingTouchdowns: 3, receptions: 32 }),
  ]),
  lineupPick("WR2", 5, "Weak WR2", ["WR"], [
    season({ season: 1990, playerId: 5, positions: ["WR"], receivingYards: 510, receivingTouchdowns: 3, receptions: 31 }),
  ]),
  lineupPick("TE", 6, "Weak TE", ["TE"], [
    season({ season: 1990, playerId: 6, positions: ["TE"], receivingYards: 310, receivingTouchdowns: 2, receptions: 26 }),
  ]),
];

const averageLineup: LineupPickInput[] = [
  lineupPick("QB", 11, "Avg QB", ["QB"], [
    season({ season: 1990, playerId: 11, positions: ["QB"], passingYards: 3350, passingTouchdowns: 20, interceptions: 12 }),
  ]),
  lineupPick("RB", 12, "Avg RB", ["RB"], [
    season({ season: 1990, playerId: 12, positions: ["RB"], rushingYards: 1240, rushingTouchdowns: 10, receptions: 30, receivingYards: 360 }),
  ]),
  lineupPick("FB", 13, "Avg FB", ["FB"], [
    season({ season: 1990, playerId: 13, positions: ["FB"], rushingYards: 360, rushingTouchdowns: 3, receptions: 22, receivingYards: 250 }),
  ]),
  lineupPick("WR1", 14, "Avg WR1", ["WR"], [
    season({ season: 1990, playerId: 14, positions: ["WR"], receivingYards: 1040, receivingTouchdowns: 8, receptions: 58 }),
  ]),
  lineupPick("WR2", 15, "Avg WR2", ["WR"], [
    season({ season: 1990, playerId: 15, positions: ["WR"], receivingYards: 980, receivingTouchdowns: 7, receptions: 54 }),
  ]),
  lineupPick("TE", 16, "Avg TE", ["TE"], [
    season({ season: 1990, playerId: 16, positions: ["TE"], receivingYards: 580, receivingTouchdowns: 5, receptions: 40 }),
  ]),
];

const eliteLineup: LineupPickInput[] = [
  lineupPick("QB", 21, "Elite QB", ["QB"], [
    season({ season: 1990, playerId: 21, positions: ["QB"], passingYards: 4800, passingTouchdowns: 28, interceptions: 8 }),
  ]),
  lineupPick("RB", 22, "Elite RB", ["RB"], [
    season({ season: 1990, playerId: 22, positions: ["RB"], rushingYards: 2200, rushingTouchdowns: 18, receptions: 40, receivingYards: 400 }),
  ]),
  lineupPick("FB", 23, "Elite FB", ["FB"], [
    season({ season: 1990, playerId: 23, positions: ["FB"], rushingYards: 700, rushingTouchdowns: 6, receptions: 30, receivingYards: 450 }),
  ]),
  lineupPick("WR1", 24, "Elite WR1", ["WR"], [
    season({ season: 1990, playerId: 24, positions: ["WR"], receivingYards: 1700, receivingTouchdowns: 16, receptions: 90 }),
  ]),
  lineupPick("WR2", 25, "Elite WR2", ["WR"], [
    season({ season: 1990, playerId: 25, positions: ["WR"], receivingYards: 1600, receivingTouchdowns: 14, receptions: 85 }),
  ]),
  lineupPick("TE", 26, "Elite TE", ["TE"], [
    season({ season: 1990, playerId: 26, positions: ["TE"], receivingYards: 1200, receivingTouchdowns: 12, receptions: 70 }),
  ]),
];

const fbDualLineup: LineupPickInput[] = [
  lineupPick("QB", 31, "QB", ["QB"], [
    season({ season: 1990, playerId: 31, positions: ["QB"], passingYards: 3500, passingTouchdowns: 22, interceptions: 10 }),
  ]),
  lineupPick("RB", 32, "RB", ["RB"], [
    season({ season: 1990, playerId: 32, positions: ["RB"], rushingYards: 1400, rushingTouchdowns: 12, receptions: 35, receivingYards: 380 }),
  ]),
  lineupPick("FB", 33, "Ware", ["FB", "RB"], [
    season({
      season: 1990,
      playerId: 33,
      positions: ["FB", "RB"],
      rushingYards: 1800,
      rushingTouchdowns: 14,
      rushingAttempts: 320,
      receptions: 50,
      receivingYards: 500,
    }),
  ]),
  lineupPick("WR1", 34, "WR1", ["WR"], [
    season({ season: 1990, playerId: 34, positions: ["WR"], receivingYards: 1100, receivingTouchdowns: 9, receptions: 62 }),
  ]),
  lineupPick("WR2", 35, "WR2", ["WR"], [
    season({ season: 1990, playerId: 35, positions: ["WR"], receivingYards: 900, receivingTouchdowns: 6, receptions: 50 }),
  ]),
  lineupPick("TE", 36, "TE", ["TE"], [
    season({ season: 1990, playerId: 36, positions: ["TE"], receivingYards: 700, receivingTouchdowns: 6, receptions: 48 }),
  ]),
];

describe("peer baseline snapshot equivalence", () => {
  const peers = buildSyntheticPeerCorpus();

  it("rejects an invalid snapshot instead of scanning the database", () => {
    expect(() => assertPeerBaselineSnapshot({})).toThrow(PeerBaselineSnapshotError);
    expect(() =>
      assertPeerBaselineSnapshot({
        version: 99,
        playerSeasonCount: 1,
        seasonRange: { min: 1970, max: 2025 },
        playableEras: ["1970s"],
        bucketCount: 1,
        buckets: { "1990:QB:passing_yards": [1] },
      }),
    ).toThrow(/unsupported/);
  });

  it.each([
    ["weak", weakLineup],
    ["average", averageLineup],
    ["elite", eliteLineup],
    ["FB dual-position", fbDualLineup],
  ] as const)("matches live baselines for a %s lineup", (_label, picks) => {
    const { oldPath, newPath } = evaluateBothWays(peers, picks);
    expectIdenticalScoring(oldPath, newPath);
  });

  it("keeps the 92.4 offense projection fixture identical on both paths", () => {
    const live = projectWinsFromRating(92.4);
    const restored = projectWinsFromRating(92.4);
    expect(restored).toEqual(live);
  });

  it("does not call loadAllSeasonStatsForPeers when scoring a completed game", async () => {
    const cards = skipScenarioCards().slice(0, 6);
    const seasonsByCard = new Map(
      cards.map((card) => [
        card.cardId,
        [season({ season: 1990, playerId: card.playerId, positions: card.positions })] as SeasonStatRecord[],
      ]),
    );
    let peerLoads = 0;
    const repository = {
      ...createInMemoryScoringRepository(cards, seasonsByCard, peers),
      async loadAllSeasonStatsForPeers() {
        peerLoads += 1;
        return peers;
      },
    };
    const session = await repository.createSession({ mode: "IQ" });
    const picks = [
      { slot: "QB" as const, card: cards[0]! },
      { slot: "RB" as const, card: cards[1]! },
      { slot: "FB" as const, card: cards[2]! },
      { slot: "WR1" as const, card: cards[3]! },
      { slot: "WR2" as const, card: cards[4]! },
      { slot: "TE" as const, card: cards[5]! },
    ];
    for (const [index, pick] of picks.entries()) {
      await repository.commitPick({
        sessionId: session.id,
        complete: index === picks.length - 1,
        pick: {
          roundNumber: index + 1,
          lineupSlot: pick.slot,
          playerId: pick.card.playerId,
          playerTeamEraCardId: pick.card.cardId,
          franchiseId: pick.card.franchiseId,
          eraId: pick.card.eraId,
        },
      });
    }

    const result = await evaluateCompletedGame(repository, session.id);
    expect(peerLoads).toBe(0);
    expect(result.offense.players).toHaveLength(6);
  });

  it("reuses the in-process parsed snapshot", () => {
    const first = loadRuntimePeerBaselines();
    const second = loadRuntimePeerBaselines();
    expect(second).toBe(first);
    expect(first.percentile(1990, "QB", "passing_yards", 4000)).toEqual(
      second.percentile(1990, "QB", "passing_yards", 4000),
    );
  });
});
