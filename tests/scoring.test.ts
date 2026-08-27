import { describe, expect, it } from "vitest";

import {
  calibratePercentileToScore,
  LINEUP_SLOT_WEIGHTS,
  POSITION_METRIC_WEIGHTS,
  SCORE_CALIBRATION,
  WIN_PROJECTION_MODEL,
} from "@/lib/scoring/config";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { evaluateOffense } from "@/lib/scoring/offenseRating";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import { percentileRank } from "@/lib/scoring/percentile";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import { selectScoringSeason } from "@/lib/scoring/selectScoringSeason";
import type { LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";
import {
  perGameWinProbabilityFromRating,
  projectWinsFromRating,
} from "@/lib/scoring/winProjection";
import type { LineupSlot } from "@/lib/football/positions";

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
  position: SeasonStatRecord["positions"][number],
  seasons: SeasonStatRecord[],
): LineupPickInput {
  return {
    lineupSlot: slot,
    playerId,
    playerName: name,
    franchiseId: 1,
    eraId: 1,
    cardId: playerId,
    firstSeason: Math.min(...seasons.map((s) => s.season)),
    lastSeason: Math.max(...seasons.map((s) => s.season)),
    positions: [position],
    seasons,
  };
}

describe("scoring engine", () => {
  const peers = buildSyntheticPeerCorpus();
  const baselines = buildPeerBaselineIndex(peers);

  it("computes same-season percentile normalization", () => {
    const eliteQb = season({
      season: 1990,
      playerId: 1,
      positions: ["QB"],
      passingYards: 4800,
      passingTouchdowns: 28,
      interceptions: 8,
    });
    const weakQb = season({
      season: 1990,
      playerId: 2,
      positions: ["QB"],
      passingYards: 2100,
      passingTouchdowns: 10,
      interceptions: 18,
    });

    const elite = scorePlayerSeason(eliteQb, "QB", baselines);
    const weak = scorePlayerSeason(weakQb, "QB", baselines);

    expect(elite.percentileRank).toBeGreaterThan(weak.percentileRank);
    expect(elite.productionScore).toBeGreaterThan(weak.productionScore);
  });

  it("applies position-specific weighting for QB passing emphasis", () => {
    const qbWeights = POSITION_METRIC_WEIGHTS.QB;
    expect(qbWeights.passing_yards).toBeGreaterThan(qbWeights.rushing_yards ?? 0);
    expect(qbWeights.passing_touchdowns).toBeGreaterThan(qbWeights.rushing_touchdowns ?? 0);
  });

  it("weights QB highest in offense talent rating", () => {
    expect(LINEUP_SLOT_WEIGHTS.QB).toBeGreaterThan(LINEUP_SLOT_WEIGHTS.RB);
    expect(LINEUP_SLOT_WEIGHTS.QB).toBeGreaterThan(LINEUP_SLOT_WEIGHTS.TE);
  });

  it("normalizes FB against FB peers rather than RB volume expectations", () => {
    const fb = season({
      season: 1990,
      playerId: 301,
      positions: ["FB"],
      rushingYards: 280,
      rushingTouchdowns: 3,
      receptions: 28,
      receivingYards: 260,
    });
    const rb = season({
      season: 1990,
      playerId: 210,
      positions: ["RB"],
      rushingYards: 280,
      rushingTouchdowns: 3,
      receptions: 28,
      receivingYards: 260,
    });

    const fbScore = scorePlayerSeason(fb, "FB", baselines);
    const rbScore = scorePlayerSeason(rb, "RB", baselines);

    expect(fbScore.productionScore).toBeGreaterThan(55);
    expect(fbScore.productionScore).toBeGreaterThan(rbScore.productionScore);
  });

  it("renormalizes weights when metrics are missing", () => {
    const partial = season({
      season: 1990,
      playerId: 3,
      positions: ["QB"],
      passingYards: 3500,
      passingTouchdowns: null,
      interceptions: null,
      rushingYards: null,
      rushingTouchdowns: null,
    });
    const scored = scorePlayerSeason(partial, "QB", baselines);
    const knownMetrics = scored.metrics.filter((metric) => metric.rawValue != null);
    expect(knownMetrics.length).toBe(1);
    expect(knownMetrics[0]?.weight).toBe(1);
    expect(scored.dataConfidence).not.toBe("HIGH");
  });

  it("uses neutral fallback when all production is missing", () => {
    const empty = season({
      season: 1990,
      playerId: 4,
      positions: ["WR"],
      games: 16,
      passingYards: null,
      passingTouchdowns: null,
      interceptions: null,
      rushingYards: null,
      rushingTouchdowns: null,
      receptions: null,
      receivingYards: null,
      receivingTouchdowns: null,
    });
    const scored = scorePlayerSeason(empty, "WR", baselines);
    expect(scored.productionScore).toBeLessThanOrEqual(SCORE_CALIBRATION.neutralScore + 2);
    expect(scored.dataConfidence).toBe("LOW");
  });

  it("selects peak season within era window, not career sum", () => {
    const seasons = [
      season({
        season: 1990,
        playerId: 5,
        positions: ["RB"],
        rushingYards: 900,
        rushingTouchdowns: 6,
      }),
      season({
        season: 1990,
        playerId: 5,
        positions: ["RB"],
        rushingYards: 1800,
        rushingTouchdowns: 14,
      }),
      season({
        season: 1990,
        playerId: 5,
        positions: ["RB"],
        rushingYards: 1100,
        rushingTouchdowns: 8,
      }),
    ];

    const selected = selectScoringSeason(seasons, "RB", baselines);
    expect(selected.season).toBe(1990);
    expect(selected.seasonStat?.rushingYards).toBe(1800);
    expect(selected.score.productionScore).toBeGreaterThan(55);
  });

  it("applies weak-link balance adjustment", () => {
    const strong = evaluateOffense([
      {
        playerId: 1,
        playerName: "A",
        lineupSlot: "QB",
        normalizedPosition: "QB",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 80,
        reliability: 1,
        overall: 80,
        productionScore: 80,
        percentileRank: 85,
        dataConfidence: "HIGH",
        metrics: [],
        selectedScoringSeason: true,
      },
      {
        playerId: 2,
        playerName: "B",
        lineupSlot: "RB",
        normalizedPosition: "RB",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 30,
        reliability: 1,
        overall: 30,
        productionScore: 30,
        percentileRank: 25,
        dataConfidence: "LOW",
        metrics: [],
        selectedScoringSeason: true,
      },
      {
        playerId: 3,
        playerName: "C",
        lineupSlot: "FB",
        normalizedPosition: "FB",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 75,
        reliability: 1,
        overall: 75,
        productionScore: 75,
        percentileRank: 78,
        dataConfidence: "HIGH",
        metrics: [],
        selectedScoringSeason: true,
      },
      {
        playerId: 4,
        playerName: "D",
        lineupSlot: "WR1",
        normalizedPosition: "WR",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 78,
        reliability: 1,
        overall: 78,
        productionScore: 78,
        percentileRank: 80,
        dataConfidence: "HIGH",
        metrics: [],
        selectedScoringSeason: true,
      },
      {
        playerId: 5,
        playerName: "E",
        lineupSlot: "WR2",
        normalizedPosition: "WR",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 76,
        reliability: 1,
        overall: 76,
        productionScore: 76,
        percentileRank: 77,
        dataConfidence: "HIGH",
        metrics: [],
        selectedScoringSeason: true,
      },
      {
        playerId: 6,
        playerName: "F",
        lineupSlot: "TE",
        normalizedPosition: "TE",
        franchiseId: 1,
        eraId: 1,
        scoringSeason: 1990,
        rawProductionScore: 74,
        reliability: 1,
        overall: 74,
        productionScore: 74,
        percentileRank: 75,
        dataConfidence: "HIGH",
        metrics: [],
        selectedScoringSeason: true,
      },
    ]);

    const balanced = evaluateOffense(
      strong.players.map((player) => ({ ...player, overall: 75 })),
    );

    expect(strong.balanceAdjustment).toBeLessThan(0);
    expect(strong.overallRating).toBeLessThan(balanced.overallRating);
  });

  it("keeps offense rating within bounds", () => {
    const picks: LineupPickInput[] = [
      lineupPick(
        "QB",
        1,
        "Elite QB",
        "QB",
        [
          season({
            season: 1990,
            playerId: 1,
            positions: ["QB"],
            passingYards: 5000,
            passingTouchdowns: 30,
            interceptions: 6,
          }),
        ],
      ),
      lineupPick(
        "RB",
        210,
        "Elite RB",
        "RB",
        [
          season({
            season: 1990,
            playerId: 210,
            positions: ["RB"],
            rushingYards: 2200,
            rushingTouchdowns: 18,
            receptions: 40,
            receivingYards: 400,
          }),
        ],
      ),
      lineupPick(
        "FB",
        307,
        "Elite FB",
        "FB",
        [
          season({
            season: 1990,
            playerId: 307,
            positions: ["FB"],
            rushingYards: 700,
            rushingTouchdowns: 6,
            receptions: 30,
            receivingYards: 450,
          }),
        ],
      ),
      lineupPick(
        "WR1",
        419,
        "Elite WR1",
        "WR",
        [
          season({
            season: 1990,
            playerId: 419,
            positions: ["WR"],
            receivingYards: 1700,
            receivingTouchdowns: 16,
            receptions: 90,
          }),
        ],
      ),
      lineupPick(
        "WR2",
        418,
        "Elite WR2",
        "WR",
        [
          season({
            season: 1990,
            playerId: 418,
            positions: ["WR"],
            receivingYards: 1600,
            receivingTouchdowns: 14,
            receptions: 85,
          }),
        ],
      ),
      lineupPick(
        "TE",
        514,
        "Elite TE",
        "TE",
        [
          season({
            season: 1990,
            playerId: 514,
            positions: ["TE"],
            receivingYards: 1200,
            receivingTouchdowns: 12,
            receptions: 70,
          }),
        ],
      ),
    ];

    const corpus = [...peers, ...picks.flatMap((pick) => pick.seasons)];
    const result = evaluateLineup(picks, buildPeerBaselineIndex(corpus));
    expect(result.offense.overallRating).toBeGreaterThan(0);
    expect(result.offense.overallRating).toBeLessThanOrEqual(100);
  });

  it("uses nonlinear win projection with bounded outputs", () => {
    const low = projectWinsFromRating(45);
    const mid = projectWinsFromRating(58);
    const high = projectWinsFromRating(88);

    expect(low.projectedWins).toBeGreaterThanOrEqual(0);
    expect(low.projectedWins).toBeLessThanOrEqual(WIN_PROJECTION_MODEL.seasonLength);
    expect(low.projectedLosses).toBe(WIN_PROJECTION_MODEL.seasonLength - low.projectedWins);

    expect(mid.perGameWinProbability).toBeGreaterThan(low.perGameWinProbability);
    expect(high.perGameWinProbability).toBeGreaterThan(mid.perGameWinProbability);

    expect(high.expectedWins - mid.expectedWins).toBeGreaterThan(
      mid.expectedWins - low.expectedWins,
    );
  });

  it("clamps per-game win probability to sensible bounds", () => {
    const low = perGameWinProbabilityFromRating(10);
    const high = perGameWinProbabilityFromRating(99);
    expect(low).toBeGreaterThanOrEqual(WIN_PROJECTION_MODEL.minWinProbability);
    expect(high).toBeLessThanOrEqual(WIN_PROJECTION_MODEL.maxWinProbability);
  });

  it("calculates perfect-season probability as p^seasonLength", () => {
    const projection = projectWinsFromRating(80);
    const expected =
      projection.perGameWinProbability ** WIN_PROJECTION_MODEL.seasonLength;
    expect(projection.perfectSeasonProbability).toBeCloseTo(expected, 8);
  });

  it("calibrates percentiles without forcing 100 ratings", () => {
    expect(calibratePercentileToScore(100)).toBeLessThanOrEqual(94);
    expect(calibratePercentileToScore(50)).toBeGreaterThan(38);
    expect(calibratePercentileToScore(50)).toBeLessThan(55);
  });

  it("treats lower interceptions as better for QBs", () => {
    const clean = season({
      season: 1990,
      playerId: 6,
      positions: ["QB"],
      passingYards: 3500,
      passingTouchdowns: 22,
      interceptions: 8,
    });
    const turnover = season({
      season: 1990,
      playerId: 7,
      positions: ["QB"],
      passingYards: 3500,
      passingTouchdowns: 22,
      interceptions: 22,
    });
    const cleanScore = scorePlayerSeason(clean, "QB", baselines);
    const turnoverScore = scorePlayerSeason(turnover, "QB", baselines);
    expect(cleanScore.productionScore).toBeGreaterThan(turnoverScore.productionScore);
  });

  it("computes percentile rank deterministically", () => {
    const values = [10, 20, 30, 40, 50];
    expect(percentileRank(30, values, "rushing_yards")).toBe(50);
    expect(percentileRank(10, values, "interceptions")).toBe(90);
  });
});
