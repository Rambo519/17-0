import { describe, expect, it } from "vitest";

import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { evaluateCompletedGame } from "@/lib/scoring/evaluateGame";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import { evaluateLineupPick } from "@/lib/scoring/playerEvaluation";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import {
  PROJECTED_RECORD_ASSUMPTION,
  WIN_PROJECTION_MODEL,
} from "@/lib/scoring/config";
import { ratingThresholdForProjectedWins } from "@/lib/scoring/winProjection";
import type { LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";
import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

function season(
  overrides: Partial<SeasonStatRecord> & Pick<SeasonStatRecord, "season" | "playerId">,
): SeasonStatRecord {
  return {
    franchiseId: overrides.franchiseId ?? 1,
    positions: overrides.positions ?? ["FB"],
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

function buildCorpus(): SeasonStatRecord[] {
  const stats: SeasonStatRecord[] = [];
  for (let i = 0; i < 20; i += 1) {
    stats.push(
      season({
        season: 2016,
        playerId: 200 + i,
        positions: ["RB"],
        rushingYards: 600 + i * 80,
        rushingTouchdowns: 4 + i,
        rushingAttempts: 150 + i * 10,
        receptions: 20 + i,
        receivingYards: 200 + i * 20,
      }),
    );
  }
  for (let i = 0; i < 12; i += 1) {
    stats.push(
      season({
        season: 2016,
        playerId: 300 + i,
        positions: ["FB"],
        rushingYards: 80 + i * 25,
        rushingTouchdowns: i,
        receptions: 10 + i,
        receivingYards: 80 + i * 20,
      }),
    );
  }
  for (let i = 0; i < 8; i += 1) {
    stats.push(
      season({
        season: 2016,
        playerId: 100 + i,
        positions: ["QB"],
        passingYards: 2800 + i * 200,
        passingTouchdowns: 18 + i,
        interceptions: 12 - i,
      }),
    );
  }
  for (let i = 0; i < 10; i += 1) {
    stats.push(
      season({
        season: 2016,
        playerId: 400 + i,
        positions: ["WR"],
        receivingYards: 600 + i * 80,
        receivingTouchdowns: 4 + i,
        receptions: 40 + i * 3,
      }),
    );
  }
  for (let i = 0; i < 8; i += 1) {
    stats.push(
      season({
        season: 2016,
        playerId: 500 + i,
        positions: ["TE"],
        receivingYards: 400 + i * 50,
        receivingTouchdowns: 3 + i,
        receptions: 30 + i * 2,
      }),
    );
  }
  return stats;
}

function pick(
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
    firstSeason: 2016,
    lastSeason: 2016,
    positions,
    seasons,
  };
}

const supportSeasons = {
  qb: season({
    season: 2016,
    playerId: 1,
    positions: ["QB"],
    passingYards: 3200,
    passingTouchdowns: 20,
    interceptions: 10,
  }),
  rb: season({
    season: 2016,
    playerId: 2,
    positions: ["RB"],
    rushingYards: 900,
    rushingTouchdowns: 6,
    receptions: 30,
    receivingYards: 250,
  }),
  wr1: season({
    season: 2016,
    playerId: 3,
    positions: ["WR"],
    receivingYards: 900,
    receivingTouchdowns: 6,
    receptions: 60,
  }),
  wr2: season({
    season: 2016,
    playerId: 4,
    positions: ["WR"],
    receivingYards: 800,
    receivingTouchdowns: 5,
    receptions: 55,
  }),
  te: season({
    season: 2016,
    playerId: 5,
    positions: ["TE"],
    receivingYards: 600,
    receivingTouchdowns: 5,
    receptions: 50,
  }),
};

function lineupWithTwoRbs(rb2: SeasonStatRecord, name: string, positions: NormalizedPosition[]): LineupPickInput[] {
  return [
    pick("QB", 1, "QB", ["QB"], [supportSeasons.qb]),
    pick("RB1", 2, "RB", ["RB"], [supportSeasons.rb]),
    pick("RB2", rb2.playerId, name, positions, [rb2]),
    pick("WR1", 3, "WR1", ["WR"], [supportSeasons.wr1]),
    pick("WR2", 4, "WR2", ["WR"], [supportSeasons.wr2]),
    pick("TE", 5, "TE", ["TE"], [supportSeasons.te]),
  ];
}

describe("two-RB slot evaluation (FB is not a playable slot)", () => {
  const peers = buildCorpus();
  const baselines = buildPeerBaselineIndex(peers);

  const ware = season({
    season: 2016,
    playerId: 900,
    positions: ["FB", "RB"],
    rushingYards: 1800,
    rushingTouchdowns: 14,
    rushingAttempts: 320,
    receptions: 50,
    receivingYards: 500,
  });

  const johnston = season({
    season: 2016,
    playerId: 901,
    positions: ["FB"],
    rushingYards: 138,
    rushingTouchdowns: 1,
    receptions: 44,
    receivingYards: 325,
  });

  it("scores RB1 and RB2 identically for the same dual RB/FB player", () => {
    const rb1 = evaluateLineupPick(
      pick("RB1", 900, "Spencer Ware", ["FB", "RB"], [ware]),
      baselines,
    );
    const rb2 = evaluateLineupPick(
      pick("RB2", 900, "Spencer Ware", ["FB", "RB"], [ware]),
      baselines,
    );

    expect(rb1.normalizedPosition).toBe("RB");
    expect(rb2.normalizedPosition).toBe("RB");
    expect(rb2.overall).toBe(rb1.overall);
  });

  it("leaves normal RB evaluation unchanged vs position RB scoring", () => {
    const rbOnly = season({ ...ware, positions: ["RB"], playerId: 910 });
    const viaSlot = evaluateLineupPick(pick("RB1", 910, "Ware RB", ["RB"], [rbOnly]), baselines);
    const viaPosition = scorePlayerSeason(rbOnly, "RB", baselines);
    expect(viaSlot.overall).toBeCloseTo(viaPosition.adjustedProductionScore, 8);
  });

  it("still has an FB position profile for historical data, unused by lineup slots", () => {
    const fbScore = scorePlayerSeason(johnston, "FB", baselines);
    const rbScore = scorePlayerSeason(
      season({ ...johnston, positions: ["RB"], playerId: 911 }),
      "RB",
      baselines,
    );
    expect(fbScore.usedNeutralFallback).toBe(false);
    expect(rbScore.usedNeutralFallback).toBe(false);
  });

  it("does not let the second RB reuse complementary FB-slot compression", () => {
    const rb1 = evaluateLineupPick(pick("RB1", 900, "Ware", ["FB", "RB"], [ware]), baselines);
    const rb2 = evaluateLineupPick(pick("RB2", 900, "Ware", ["FB", "RB"], [ware]), baselines);
    expect(rb2.overall).toBe(rb1.overall);
    expect(rb2.overall).toBeGreaterThan(70);
  });

  it("is deterministic for the same six cards in the same slots", () => {
    const corpus = [...peers, ware, ...Object.values(supportSeasons)];
    const index = buildPeerBaselineIndex(corpus);
    const picks = lineupWithTwoRbs(ware, "Ware", ["FB", "RB"]);
    const first = evaluateLineup(picks, index);
    const second = evaluateLineup(picks, index);
    expect(first.offense.overallRating).toBe(second.offense.overallRating);
    expect(first.projection.expectedWins).toBe(second.projection.expectedWins);
    expect(first.projection.projectedWins).toBe(second.projection.projectedWins);
  });

  it("does not take game mode; CLASSIC and IQ share evaluateLineup", () => {
    expect(evaluateCompletedGame.length).toBe(2);
    expect(PROJECTED_RECORD_ASSUMPTION).toContain("league-average");
  });

  it("does not change the approved 17-0 win-curve threshold", () => {
    expect(WIN_PROJECTION_MODEL.seasonLength).toBe(17);
    expect(WIN_PROJECTION_MODEL.maxWinProbability).toBe(0.99);
    expect(ratingThresholdForProjectedWins(17)).toBeCloseTo(92.25, 1);
  });
});
