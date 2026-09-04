import { describe, expect, it } from "vitest";

import { calibratePercentileToScore, SCORE_CALIBRATION } from "@/lib/scoring/config";
import { evaluateLineup } from "@/lib/scoring/evaluateLineup";
import { buildPeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import {
  applyReliabilityShrinkage,
  computeSeasonReliability,
} from "@/lib/scoring/reliability";
import { scorePlayerSeason } from "@/lib/scoring/playerSeasonScore";
import { selectScoringSeason } from "@/lib/scoring/selectScoringSeason";
import type { LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";
import {
  projectWinsFromRating,
  perfectSeasonProbabilityFromWinProbability,
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

function buildQbPeerCorpus(): SeasonStatRecord[] {
  const stats: SeasonStatRecord[] = [];
  for (let i = 0; i < 24; i += 1) {
    stats.push(
      season({
        season: 1990,
        playerId: 100 + i,
        positions: ["QB"],
        games: 16,
        passingYards: 2000 + i * 80,
        passingTouchdowns: 10 + i,
        interceptions: 18 - Math.floor(i / 3),
      }),
    );
  }
  return stats;
}

function lineupPick(
  slot: LineupSlot,
  id: number,
  name: string,
  position: SeasonStatRecord["positions"][number],
  seasons: SeasonStatRecord[],
): LineupPickInput {
  return {
    lineupSlot: slot,
    playerId: id,
    playerName: name,
    franchiseId: 1,
    eraId: 1,
    cardId: id,
    firstSeason: Math.min(...seasons.map((s) => s.season)),
    lastSeason: Math.max(...seasons.map((s) => s.season)),
    positions: [position],
    seasons,
  };
}

describe("scoring calibration (Phase 5B)", () => {
  const baselines = buildPeerBaselineIndex(buildQbPeerCorpus());

  it("shrinks low-volume seasons toward neutral", () => {
    const lowVolume = season({
      season: 1990,
      playerId: 1,
      positions: ["QB"],
      games: 3,
      passingYards: 4800,
      passingTouchdowns: 35,
      interceptions: 4,
    });
    const fullSeason = season({
      season: 1990,
      playerId: 2,
      positions: ["QB"],
      games: 16,
      passingYards: 3500,
      passingTouchdowns: 22,
      interceptions: 10,
    });

    const low = scorePlayerSeason(lowVolume, "QB", baselines);
    const full = scorePlayerSeason(fullSeason, "QB", baselines);

    expect(low.reliability).toBeLessThan(full.reliability);
    expect(low.adjustedProductionScore).toBeLessThan(low.rawProductionScore);
    expect(full.reliability).toBeGreaterThan(0.8);
    expect(low.adjustedProductionScore).toBeLessThan(full.adjustedProductionScore);
  });

  it("keeps high-volume reliability near 1", () => {
    const full = season({
      season: 1990,
      playerId: 3,
      positions: ["QB"],
      games: 16,
      passingYards: 4000,
      passingTouchdowns: 28,
      interceptions: 8,
    });
    const scored = scorePlayerSeason(full, "QB", baselines);
    expect(scored.reliability).toBeGreaterThan(0.85);
    expect(scored.adjustedProductionScore).toBeCloseTo(scored.rawProductionScore, 0.5);
  });

  it("prefers reliable full season over tiny-sample outlier when adjusted", () => {
    const outlier = season({
      season: 1990,
      playerId: 4,
      positions: ["QB"],
      games: 2,
      passingYards: 5200,
      passingTouchdowns: 40,
      interceptions: 1,
    });
    const steady = season({
      season: 1991,
      playerId: 4,
      positions: ["QB"],
      games: 16,
      passingYards: 3600,
      passingTouchdowns: 24,
      interceptions: 9,
    });

    const peers = [
      ...buildQbPeerCorpus(),
      outlier,
      steady,
      season({
        season: 1991,
        playerId: 200,
        positions: ["QB"],
        games: 16,
        passingYards: 3000,
        passingTouchdowns: 18,
        interceptions: 12,
      }),
    ];
    const eraBaselines = buildPeerBaselineIndex(peers);
    const selected = selectScoringSeason([outlier, steady], "QB", eraBaselines);

    expect(selected.season).toBe(1991);
    expect(selected.score.adjustedProductionScore).toBeGreaterThan(
      scorePlayerSeason(outlier, "QB", eraBaselines).adjustedProductionScore,
    );
  });

  it("keeps the earlier full season unless a later one beats it by more than 0.5", () => {
    const rbPeers = (year: number, idOffset: number) => {
      const rows: SeasonStatRecord[] = [];
      for (let i = 0; i < 300; i += 1) {
        rows.push(
          season({
            season: year,
            playerId: idOffset + i,
            positions: ["RB"],
            games: 16,
            rushingYards: 400 + i * 5,
            rushingTouchdowns: 6,
            receptions: 20,
            receivingYards: 180,
            receivingTouchdowns: 1,
          }),
        );
      }
      return rows;
    };
    const earlier = season({
      season: 1990,
      playerId: 4,
      positions: ["RB"],
      games: 16,
      rushingYards: 1200,
      rushingTouchdowns: 6,
      receptions: 20,
      receivingYards: 180,
      receivingTouchdowns: 1,
    });
    const yearPeers = [...rbPeers(1990, 1000), ...rbPeers(1991, 2000)];

    let found = false;
    for (let extraYards = 1; extraYards <= 80; extraYards += 1) {
      const candidate = season({
        season: 1991,
        playerId: 4,
        positions: ["RB"],
        games: 16,
        rushingYards: 1200 + extraYards,
        rushingTouchdowns: 6,
        receptions: 20,
        receivingYards: 180,
        receivingTouchdowns: 1,
      });
      const eraBaselines = buildPeerBaselineIndex([...yearPeers, earlier, candidate]);
      const candidateGap =
        scorePlayerSeason(candidate, "RB", eraBaselines).adjustedProductionScore -
        scorePlayerSeason(earlier, "RB", eraBaselines).adjustedProductionScore;
      if (candidateGap > 0.08 && candidateGap < 0.45) {
        expect(selectScoringSeason([earlier, candidate], "RB", eraBaselines).season).toBe(1990);
        expect(
          selectScoringSeason([earlier, candidate], "RB", eraBaselines, { switchThreshold: 0 }).season,
        ).toBe(1991);
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it("increases reliability monotonically with games when production is similar", () => {
    const rel4 = computeSeasonReliability(
      season({
        season: 1990,
        playerId: 10,
        positions: ["RB"],
        games: 4,
        rushingYards: 800,
        rushingTouchdowns: 6,
      }),
      "RB",
      buildPeerBaselineIndex([
        ...buildQbPeerCorpus(),
        season({
          season: 1990,
          playerId: 300,
          positions: ["RB"],
          games: 16,
          rushingYards: 1200,
          rushingTouchdowns: 8,
        }),
      ]),
    );
    const rel12 = computeSeasonReliability(
      season({
        season: 1990,
        playerId: 11,
        positions: ["RB"],
        games: 12,
        rushingYards: 800,
        rushingTouchdowns: 6,
      }),
      "RB",
      buildPeerBaselineIndex([
        ...buildQbPeerCorpus(),
        season({
          season: 1990,
          playerId: 300,
          positions: ["RB"],
          games: 16,
          rushingYards: 1200,
          rushingTouchdowns: 8,
        }),
      ]),
    );
    expect(rel12.reliability).toBeGreaterThan(rel4.reliability);
  });

  it("separates upper percentiles more strongly", () => {
    const p75 = calibratePercentileToScore(75);
    const p90 = calibratePercentileToScore(90);
    const p99 = calibratePercentileToScore(99);
    expect(p90 - p75).toBeGreaterThan(8);
    expect(p99 - p90).toBeGreaterThan(4);
    expect(p99).toBeLessThanOrEqual(SCORE_CALIBRATION.maxScore);
    expect(calibratePercentileToScore(50)).toBeGreaterThan(45);
    expect(calibratePercentileToScore(50)).toBeLessThan(55);
  });

  it("never allows neutral fallback to produce elite ratings", () => {
    const adjusted = applyReliabilityShrinkage(50, 0.15, true);
    expect(adjusted).toBeLessThanOrEqual(SCORE_CALIBRATION.neutralScore + 2);
  });

  it("keeps offense rating monotonic for increasing player quality", () => {
    const peers = buildPeerBaselineIndex([
      ...buildQbPeerCorpus(),
      ...Array.from({ length: 20 }, (_, i) =>
        season({
          season: 1990,
          playerId: 400 + i,
          positions: ["WR"],
          games: 16,
          receivingYards: 500 + i * 50,
          receivingTouchdowns: 3 + i,
          receptions: 30 + i,
        }),
      ),
      ...Array.from({ length: 12 }, (_, i) =>
        season({
          season: 1990,
          playerId: 500 + i,
          positions: ["TE"],
          games: 16,
          receivingYards: 300 + i * 40,
          receivingTouchdowns: 2 + i,
          receptions: 25 + i,
        }),
      ),
    ]);

    const weak = evaluateLineup(
      [
        lineupPick("QB", 1, "Weak QB", "QB", [
          season({
            season: 1990,
            playerId: 1,
            positions: ["QB"],
            games: 16,
            passingYards: 2200,
            passingTouchdowns: 12,
            interceptions: 16,
          }),
        ]),
        lineupPick("RB1", 2, "Weak RB", "RB", [
          season({
            season: 1990,
            playerId: 2,
            positions: ["RB"],
            games: 16,
            rushingYards: 700,
            rushingTouchdowns: 4,
          }),
        ]),
        lineupPick("RB2", 3, "Weak RB2", "RB", [
          season({
            season: 1990,
            playerId: 3,
            positions: ["FB"],
            games: 16,
            rushingYards: 250,
            receptions: 12,
            receivingYards: 120,
          }),
        ]),
        lineupPick("WR1", 4, "Weak WR1", "WR", [
          season({
            season: 1990,
            playerId: 4,
            positions: ["WR"],
            games: 16,
            receivingYards: 520,
            receivingTouchdowns: 2,
            receptions: 28,
          }),
        ]),
        lineupPick("WR2", 5, "Weak WR2", "WR", [
          season({
            season: 1990,
            playerId: 5,
            positions: ["WR"],
            games: 16,
            receivingYards: 480,
            receivingTouchdowns: 2,
            receptions: 24,
          }),
        ]),
        lineupPick("TE", 6, "Weak TE", "TE", [
          season({
            season: 1990,
            playerId: 6,
            positions: ["TE"],
            games: 16,
            receivingYards: 320,
            receivingTouchdowns: 1,
            receptions: 22,
          }),
        ]),
      ],
      peers,
    );

    const elite = evaluateLineup(
      [
        lineupPick("QB", 7, "Elite QB", "QB", [
          season({
            season: 1990,
            playerId: 7,
            positions: ["QB"],
            games: 16,
            passingYards: 4800,
            passingTouchdowns: 34,
            interceptions: 8,
          }),
        ]),
        lineupPick("RB1", 8, "Elite RB", "RB", [
          season({
            season: 1990,
            playerId: 8,
            positions: ["RB"],
            games: 16,
            rushingYards: 2100,
            rushingTouchdowns: 18,
            receptions: 45,
            receivingYards: 420,
          }),
        ]),
        lineupPick("RB2", 9, "Elite RB2", "RB", [
          season({
            season: 1990,
            playerId: 9,
            positions: ["FB"],
            games: 16,
            rushingYards: 700,
            rushingTouchdowns: 6,
            receptions: 35,
            receivingYards: 420,
          }),
        ]),
        lineupPick("WR1", 10, "Elite WR1", "WR", [
          season({
            season: 1990,
            playerId: 10,
            positions: ["WR"],
            games: 16,
            receivingYards: 1700,
            receivingTouchdowns: 16,
            receptions: 95,
          }),
        ]),
        lineupPick("WR2", 11, "Elite WR2", "WR", [
          season({
            season: 1990,
            playerId: 11,
            positions: ["WR"],
            games: 16,
            receivingYards: 1500,
            receivingTouchdowns: 12,
            receptions: 88,
          }),
        ]),
        lineupPick("TE", 12, "Elite TE", "TE", [
          season({
            season: 1990,
            playerId: 12,
            positions: ["TE"],
            games: 16,
            receivingYards: 1200,
            receivingTouchdowns: 12,
            receptions: 75,
          }),
        ]),
      ],
      peers,
    );

    expect(elite.offense.overallRating).toBeGreaterThan(weak.offense.overallRating);
    expect(elite.projection.expectedWins).toBeGreaterThan(weak.projection.expectedWins);
  });

  it("keeps expected wins monotonic with offense rating", () => {
    const ratings = [45, 55, 65, 75, 85, 92];
    const wins = ratings.map((rating) => projectWinsFromRating(rating).expectedWins);
    for (let i = 1; i < wins.length; i += 1) {
      expect(wins[i]).toBeGreaterThan(wins[i - 1]!);
    }
  });

  it("maintains perfect-season probability under the k-blend season model", () => {
    const projection = projectWinsFromRating(82);
    expect(projection.perfectSeasonProbability).toBeCloseTo(
      perfectSeasonProbabilityFromWinProbability(projection.perGameWinProbability),
      10,
    );
  });

  it("places elite QB seasons from multiple eras in comparable bands", () => {
    const peers: SeasonStatRecord[] = [];
    for (let year = 1978; year <= 2022; year += 11) {
      for (let i = 0; i < 18; i += 1) {
        peers.push(
          season({
            season: year,
            playerId: year * 100 + i,
            positions: ["QB"],
            games: 14,
            passingYards: 2000 + i * 60,
            passingTouchdowns: 10 + i,
            interceptions: 20 - Math.floor(i / 2),
          }),
        );
      }
    }
    peers.push(
      season({
        season: 1978,
        playerId: 9001,
        positions: ["QB"],
        games: 16,
        passingYards: 3400,
        passingTouchdowns: 30,
        interceptions: 10,
      }),
    );
    peers.push(
      season({
        season: 2022,
        playerId: 9004,
        positions: ["QB"],
        games: 16,
        passingYards: 5400,
        passingTouchdowns: 45,
        interceptions: 8,
      }),
    );

    const eraBaselines = buildPeerBaselineIndex(peers);
    const oldElite = scorePlayerSeason(peers[peers.length - 2]!, "QB", eraBaselines);
    const newElite = scorePlayerSeason(peers[peers.length - 1]!, "QB", eraBaselines);
    expect(oldElite.adjustedProductionScore).toBeGreaterThan(70);
    expect(newElite.adjustedProductionScore).toBeGreaterThan(70);
    expect(
      Math.abs(oldElite.adjustedProductionScore - newElite.adjustedProductionScore),
    ).toBeLessThan(18);
  });
});
