import { describe, expect, it } from "vitest";

import { calibratePercentileToScore } from "@/lib/scoring/config";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import type { LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";

function qbSeason(
  season: number,
  playerId: number,
  passingYards: number,
  passingTouchdowns: number,
  interceptions: number,
): SeasonStatRecord {
  return {
    season,
    playerId,
    franchiseId: 1,
    positions: ["QB"],
    games: 16,
    gamesStarted: 16,
    passingYards,
    passingTouchdowns,
    interceptions,
    rushingYards: null,
    rushingAttempts: null,
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
  };
}

describe("historical scoring fairness", () => {
  it("places elite QB seasons from different eras in comparable percentile bands", () => {
    const peers: SeasonStatRecord[] = [];

    for (let year = 1978; year <= 2022; year += 11) {
      for (let i = 0; i < 18; i += 1) {
        peers.push(
          qbSeason(year, year * 100 + i, 2000 + i * 60, 10 + i, 20 - Math.floor(i / 2)),
        );
      }
    }

    peers.push(qbSeason(1978, 9001, 3400, 30, 10));
    peers.push(qbSeason(1989, 9002, 4100, 36, 12));
    peers.push(qbSeason(2000, 9003, 4500, 38, 9));
    peers.push(qbSeason(2022, 9004, 5400, 45, 8));

    const baselines = buildPeerBaselineIndex(peers);
    const eliteScores = [
      scorePlayerSeason(qbSeason(1978, 9001, 3200, 28, 12), "QB", baselines),
      scorePlayerSeason(qbSeason(1989, 9002, 3900, 33, 14), "QB", baselines),
      scorePlayerSeason(qbSeason(2000, 9003, 4200, 35, 11), "QB", baselines),
      scorePlayerSeason(qbSeason(2022, 9004, 5200, 41, 10), "QB", baselines),
    ];

    for (const score of eliteScores) {
      expect(score.percentileRank).toBeGreaterThan(70);
      expect(score.productionScore).toBeGreaterThan(68);
    }

    const spread =
      Math.max(...eliteScores.map((score) => score.productionScore)) -
      Math.min(...eliteScores.map((score) => score.productionScore));
    expect(spread).toBeLessThan(20);
  });

  it("does not map ordinary percentiles to elite calibrated scores", () => {
    expect(calibratePercentileToScore(50)).toBeLessThan(55);
    expect(calibratePercentileToScore(85)).toBeGreaterThan(70);
    expect(calibratePercentileToScore(85)).toBeLessThan(84);
  });

  it("separates weak and elite synthetic lineups in projected wins", () => {
    const peers: SeasonStatRecord[] = [];
    for (let i = 0; i < 24; i += 1) {
      peers.push({
        season: 1990,
        playerId: 1000 + i,
        franchiseId: 1,
        positions: ["QB", "RB", "FB", "WR", "TE"],
        games: 16,
        gamesStarted: 12,
        passingYards: 2500 + i * 50,
        passingTouchdowns: 14 + i,
        interceptions: 16 - Math.floor(i / 3),
        rushingYards: 900 + i * 40,
        rushingAttempts: 200 + i * 5,
        rushingTouchdowns: 6 + Math.floor(i / 4),
        receptions: 20 + i,
        receivingYards: 350 + i * 20,
        receivingTouchdowns: 2 + Math.floor(i / 5),
      });
    }

    const baselines = buildPeerBaselineIndex(peers);

    function pick(
      slot: LineupPickInput["lineupSlot"],
      id: number,
      name: string,
      overrides: Partial<SeasonStatRecord>,
    ): LineupPickInput {
      const stat: SeasonStatRecord = {
        season: 1990,
        playerId: id,
        franchiseId: 1,
        positions: ["QB"],
        games: 16,
        gamesStarted: 16,
        passingYards: null,
        passingTouchdowns: null,
        interceptions: null,
        rushingYards: null,
        rushingAttempts: null,
        rushingTouchdowns: null,
        receptions: null,
        receivingYards: null,
        receivingTouchdowns: null,
        ...overrides,
      };
      return {
        lineupSlot: slot,
        playerId: id,
        playerName: name,
        franchiseId: 1,
        eraId: 1,
        cardId: id,
        firstSeason: 1990,
        lastSeason: 1990,
        positions: stat.positions,
        seasons: [stat],
      };
    }

    const weak = evaluateLineup(
      [
        pick("QB", 1, "Weak QB", {
          positions: ["QB"],
          passingYards: 2100,
          passingTouchdowns: 10,
          interceptions: 18,
        }),
        pick("RB1", 2, "Weak RB", {
          positions: ["RB"],
          rushingYards: 650,
          rushingTouchdowns: 4,
        }),
        pick("RB2", 3, "Weak RB2", {
          positions: ["FB"],
          rushingYards: 250,
          receptions: 12,
          receivingYards: 120,
        }),
        pick("WR1", 4, "Weak WR1", {
          positions: ["WR"],
          receivingYards: 520,
          receivingTouchdowns: 2,
          receptions: 28,
        }),
        pick("WR2", 5, "Weak WR2", {
          positions: ["WR"],
          receivingYards: 480,
          receivingTouchdowns: 2,
          receptions: 24,
        }),
        pick("TE", 6, "Weak TE", {
          positions: ["TE"],
          receivingYards: 320,
          receivingTouchdowns: 1,
          receptions: 22,
        }),
      ],
      baselines,
    );

    const elite = evaluateLineup(
      [
        pick("QB", 7, "Elite QB", {
          positions: ["QB"],
          passingYards: 4800,
          passingTouchdowns: 34,
          interceptions: 8,
        }),
        pick("RB1", 8, "Elite RB", {
          positions: ["RB"],
          rushingYards: 2100,
          rushingTouchdowns: 18,
          receptions: 45,
          receivingYards: 420,
        }),
        pick("RB2", 9, "Elite RB2", {
          positions: ["FB"],
          rushingYards: 700,
          rushingTouchdowns: 6,
          receptions: 35,
          receivingYards: 420,
        }),
        pick("WR1", 10, "Elite WR1", {
          positions: ["WR"],
          receivingYards: 1700,
          receivingTouchdowns: 16,
          receptions: 95,
        }),
        pick("WR2", 11, "Elite WR2", {
          positions: ["WR"],
          receivingYards: 1500,
          receivingTouchdowns: 12,
          receptions: 88,
        }),
        pick("TE", 12, "Elite TE", {
          positions: ["TE"],
          receivingYards: 1200,
          receivingTouchdowns: 12,
          receptions: 75,
        }),
      ],
      baselines,
    );

    expect(weak.projection.projectedWins).toBeLessThan(elite.projection.projectedWins);
    expect(elite.projection.expectedWins).toBeGreaterThan(weak.projection.expectedWins);
    expect(elite.projection.perfectSeasonProbability).toBeGreaterThanOrEqual(
      weak.projection.perfectSeasonProbability,
    );
  });
});
