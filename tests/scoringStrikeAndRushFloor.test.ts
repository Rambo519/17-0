import { describe, expect, it } from "vitest";

import { peerComparisonSeasons } from "@/lib/scoring/config";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import type { SeasonStatRecord } from "@/lib/scoring/types";

function wr(season: number, playerId: number, yards: number): SeasonStatRecord {
  return {
    season,
    playerId,
    franchiseId: 1,
    positions: ["WR"],
    games: 16,
    gamesStarted: 16,
    passingYards: null,
    passingTouchdowns: null,
    interceptions: null,
    rushingYards: 0,
    rushingAttempts: 0,
    rushingTouchdowns: 0,
    receptions: Math.round(yards / 14),
    receivingYards: yards,
    receivingTouchdowns: Math.max(1, Math.round(yards / 200)),
  };
}

function rb(
  season: number,
  playerId: number,
  rushYards: number,
  rushTd: number,
  rec: number,
  recYards: number,
  recTd: number,
): SeasonStatRecord {
  return {
    season,
    playerId,
    franchiseId: 1,
    positions: ["RB"],
    games: 14,
    gamesStarted: 14,
    passingYards: null,
    passingTouchdowns: null,
    interceptions: null,
    rushingYards: rushYards,
    rushingAttempts: 300,
    rushingTouchdowns: rushTd,
    receptions: rec,
    receivingYards: recYards,
    receivingTouchdowns: recTd,
  };
}

describe("strike-year peer comparison windows", () => {
  it("pools 1982 and 1987 with adjacent full seasons", () => {
    expect(peerComparisonSeasons(1982)).toEqual([1981, 1982, 1983]);
    expect(peerComparisonSeasons(1987)).toEqual([1986, 1987, 1988]);
    expect(peerComparisonSeasons(1986)).toEqual([1986]);
    expect(peerComparisonSeasons(1999)).toEqual([1999]);
  });

  it("does not treat a strike-year leaderboard as an all-time peer pool", () => {
    const peers: SeasonStatRecord[] = [];
    for (let i = 0; i < 40; i += 1) {
      peers.push(wr(1986, 100 + i, 200 + i * 30));
      peers.push(wr(1988, 300 + i, 220 + i * 28));
    }
    for (let i = 0; i < 80; i += 1) {
      peers.push(wr(1987, 500 + i, i < 70 ? 40 + i : 200 + (i - 70) * 20));
    }
    const strikeLeader = wr(1987, 999, 1117);
    peers.push(strikeLeader);
    const fullSeasonStar = wr(1986, 998, 1570);
    peers.push(fullSeasonStar);
    const baselines = buildPeerBaselineIndex(peers);
    expect(baselines.peerValues(1987, "WR", "receiving_yards").length).toBe(40 + 41 + 81);

    const riceLike = scorePlayerSeason(fullSeasonStar, "WR", baselines);
    const jtLike = scorePlayerSeason(strikeLeader, "WR", baselines);
    expect(riceLike.productionScore).toBeGreaterThan(jtLike.productionScore);
    expect(jtLike.percentileRank).toBeLessThan(99.5);
  });
});

describe("RB elite rushing floor", () => {
  it("keeps a historically elite rushing season out of the 70s when receiving is tiny", () => {
    const peers: SeasonStatRecord[] = [];
    for (let i = 0; i < 40; i += 1) {
      peers.push(rb(1973, 100 + i, 400 + i * 30, 2 + Math.floor(i / 8), 20 + i, 180 + i * 8, Math.floor(i / 10)));
    }
    const oj1973 = rb(1973, 1, 2003, 12, 6, 70, 0);
    peers.push(oj1973);
    const baselines = buildPeerBaselineIndex(peers);
    const scored = scorePlayerSeason(oj1973, "RB", baselines);
    expect(scored.percentileRank).toBeGreaterThan(96);
    expect(scored.productionScore).toBeGreaterThan(88);
  });

  it("does not lift an ordinary rusher with modest receiving", () => {
    const peers: SeasonStatRecord[] = [];
    for (let i = 0; i < 40; i += 1) {
      peers.push(rb(1995, 100 + i, 400 + i * 30, 2 + Math.floor(i / 8), 15 + i, 120 + i * 10, Math.floor(i / 10)));
    }
    const ordinary = rb(1995, 2, 700, 4, 18, 140, 1);
    peers.push(ordinary);
    const baselines = buildPeerBaselineIndex(peers);
    const scored = scorePlayerSeason(ordinary, "RB", baselines);
    expect(scored.percentileRank).toBeLessThan(80);
  });
});
