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

function lineupWithFb(fb: SeasonStatRecord, name: string, positions: NormalizedPosition[]): LineupPickInput[] {
  return [
    pick("QB", 1, "QB", ["QB"], [supportSeasons.qb]),
    pick("RB", 2, "RB", ["RB"], [supportSeasons.rb]),
    pick("FB", fb.playerId, name, positions, [fb]),
    pick("WR1", 3, "WR1", ["WR"], [supportSeasons.wr1]),
    pick("WR2", 4, "WR2", ["WR"], [supportSeasons.wr2]),
    pick("TE", 5, "TE", ["TE"], [supportSeasons.te]),
  ];
}

describe("FB-slot evaluation", () => {
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

  const replacementFb = season({
    season: 2016,
    playerId: 902,
    positions: ["FB"],
    rushingYards: 40,
    rushingTouchdowns: 0,
    receptions: 4,
    receivingYards: 20,
  });

  it("gives a dual RB/FB different scores by slot and does not explode at FB", () => {
    const rbScore = evaluateLineupPick(
      pick("RB", 900, "Spencer Ware", ["FB", "RB"], [ware]),
      baselines,
    );
    const fbScore = evaluateLineupPick(
      pick("FB", 900, "Spencer Ware", ["FB", "RB"], [ware]),
      baselines,
    );

    expect(fbScore.overall).not.toBe(rbScore.overall);
    expect(fbScore.overall).toBeLessThan(80);
    expect(fbScore.overall).toBeLessThan(rbScore.overall);
  });

  it("leaves normal RB evaluation on the RB slot unchanged vs position RB scoring", () => {
    const rbOnly = season({ ...ware, positions: ["RB"], playerId: 910 });
    const viaSlot = evaluateLineupPick(pick("RB", 910, "Ware RB", ["RB"], [rbOnly]), baselines);
    const viaPosition = scorePlayerSeason(rbOnly, "RB", baselines);
    expect(viaSlot.overall).toBeCloseTo(viaPosition.adjustedProductionScore, 8);
  });

  it("keeps a traditional receiving FB ahead of a replacement FB", () => {
    const strong = evaluateLineupPick(pick("FB", 901, "Johnston", ["FB"], [johnston]), baselines);
    const weak = evaluateLineupPick(
      pick("FB", 902, "Replacement", ["FB"], [replacementFb]),
      baselines,
    );
    expect(strong.overall).toBeGreaterThan(weak.overall);
    expect(strong.overall).toBeGreaterThan(55);
  });

  it("does not let FB alone swing multiple projected wins", () => {
    const corpus = [
      ...peers,
      ware,
      johnston,
      replacementFb,
      supportSeasons.qb,
      supportSeasons.rb,
      supportSeasons.wr1,
      supportSeasons.wr2,
      supportSeasons.te,
    ];
    const index = buildPeerBaselineIndex(corpus);

    const replacement = evaluateLineup(
      lineupWithFb(replacementFb, "Replacement", ["FB"]),
      index,
    );
    const traditional = evaluateLineup(lineupWithFb(johnston, "Johnston", ["FB"]), index);
    const feature = evaluateLineup(lineupWithFb(ware, "Ware", ["FB", "RB"]), index);

    expect(traditional.projection.expectedWins).toBeGreaterThan(replacement.projection.expectedWins);
    expect(feature.projection.expectedWins - replacement.projection.expectedWins).toBeLessThan(1.5);
    expect(traditional.projection.expectedWins - replacement.projection.expectedWins).toBeLessThan(
      1.5,
    );
  });

  it("is deterministic for the same six cards in the same slots", () => {
    const corpus = [...peers, ware, ...Object.values(supportSeasons)];
    const index = buildPeerBaselineIndex(corpus);
    const picks = lineupWithFb(ware, "Ware", ["FB", "RB"]);
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
    expect(ratingThresholdForProjectedWins(17)).toBeCloseTo(92.86, 1);
  });
});
