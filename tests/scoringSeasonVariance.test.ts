import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { formatPerfectSeasonChance } from "@/lib/results/format";
import { SEASON_VARIANCE_K, WIN_PROJECTION_MODEL } from "@/lib/scoring/config";
import {
  displayedSeasonWins,
  expectedRecordWinsFromRating,
  perGameWinProbabilityFromRating,
  projectWinsFromRating,
  simulateSeasonWins,
} from "@/lib/scoring/winProjection";

function binomialPmf(n: number, k: number, p: number): number {
  if (k < 0 || k > n) return 0;
  if (p <= 0) return k === 0 ? 1 : 0;
  if (p >= 1) return k === n ? 1 : 0;
  let logC = 0;
  for (let i = 1; i <= k; i += 1) {
    logC += Math.log(n - k + i) - Math.log(i);
  }
  return Math.exp(logC + k * Math.log(p) + (n - k) * Math.log(1 - p));
}

function exactRecordShare(rating: number, targetWins: number): number {
  const seasonLength = WIN_PROJECTION_MODEL.seasonLength;
  const p = perGameWinProbabilityFromRating(rating);
  const mu = seasonLength * p;
  let share = 0;
  for (let binomialWins = 0; binomialWins <= seasonLength; binomialWins += 1) {
    const wins = Math.max(
      0,
      Math.min(seasonLength, Math.round(mu + SEASON_VARIANCE_K * (binomialWins - mu))),
    );
    if (wins === targetWins) share += binomialPmf(seasonLength, binomialWins, p);
  }
  return share;
}

describe("stochastic season variance", () => {
  it("locks k at 0.35", () => {
    expect(SEASON_VARIANCE_K).toBe(0.35);
  });

  it("does not use Math.random in the win-projection path", async () => {
    const source = await readFile(path.join(process.cwd(), "src/lib/scoring/winProjection.ts"), "utf8");
    expect(source).not.toMatch(/Math\.random/);
  });

  it("keeps expected wins independent of the season seed and equal to 17p", () => {
    for (const rating of [76, 84, 86.7, 87, 88.5, 90.8]) {
      const lineup = projectWinsFromRating(rating);
      const seeded = projectWinsFromRating(rating, "11111111-1111-4111-8111-111111111111");
      expect(seeded.expectedWins).toBe(lineup.expectedWins);
      expect(seeded.perGameWinProbability).toBe(lineup.perGameWinProbability);
      expect(seeded.perfectSeasonProbability).toBe(lineup.perfectSeasonProbability);
      expect(seeded.expectedWins).toBeCloseTo(
        WIN_PROJECTION_MODEL.seasonLength * seeded.perGameWinProbability,
        12,
      );
    }
  });

  it("returns the same displayed record for the same session id", () => {
    const sessionId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const first = projectWinsFromRating(86.7, sessionId);
    const second = projectWinsFromRating(86.7, sessionId);
    expect(second.projectedWins).toBe(first.projectedWins);
    expect(second.projectedLosses).toBe(first.projectedLosses);
    expect(simulateSeasonWins(perGameWinProbabilityFromRating(86.7), sessionId)).toBe(
      first.projectedWins,
    );
  });

  it("varies the displayed record across session ids at a typical BEST rating", () => {
    const records = new Set<number>();
    for (let index = 0; index < 400; index += 1) {
      const seed = `game-${index.toString(16).padStart(8, "0")}-variance`;
      records.add(projectWinsFromRating(86.7, seed).projectedWins);
    }
    expect(records.has(15)).toBe(true);
    expect(records.has(16)).toBe(true);
    expect(records.size).toBeGreaterThanOrEqual(2);
  });

  it("matches the measured k = 0.35 record mix at the C6 knots", { timeout: 20_000 }, () => {
    const sampleSize = 40_000;
    const cases = [
      { rating: 84, wins: 15, expected: exactRecordShare(84, 15) },
      { rating: 87, wins: 16, expected: exactRecordShare(87, 16) },
      { rating: 88.5, wins: 17, expected: exactRecordShare(88.5, 17) },
      { rating: 88.5, wins: 16, expected: exactRecordShare(88.5, 16) },
      { rating: 88.5, wins: 15, expected: exactRecordShare(88.5, 15) },
    ];

    expect(exactRecordShare(88.5, 17)).toBeCloseTo(0.601998, 4);
    expect(exactRecordShare(88.5, 16)).toBeCloseTo(0.396692, 4);
    expect(exactRecordShare(88.5, 15)).toBeCloseTo(0.001309, 5);
    expect(exactRecordShare(87, 16)).toBeCloseTo(0.550122, 4);
    expect(exactRecordShare(84, 15)).toBeCloseTo(0.533694, 4);

    for (const { rating, wins, expected } of cases) {
      let hits = 0;
      for (let index = 0; index < sampleSize; index += 1) {
        const seed = `${rating}:${index}`;
        if (projectWinsFromRating(rating, seed).projectedWins === wins) hits += 1;
      }
      expect(hits / sampleSize).toBeCloseTo(expected, 2);
    }
  });

  it("never produces 14-3 or worse at or above the 17-0 knot", { timeout: 20_000 }, () => {
    const ratings = [88.5, 89, 89.5, 90.8, 93, 100];
    const samplesPerRating = 20_000;
    for (const rating of ratings) {
      expect(expectedRecordWinsFromRating(rating)).toBe(17);
      for (let index = 0; index < samplesPerRating; index += 1) {
        const wins = projectWinsFromRating(rating, `elite-${rating}-${index}`).projectedWins;
        expect(wins).toBeGreaterThanOrEqual(15);
      }
    }
  });

  it("sets Perfect Season Chance to the exact k-blend P(17-0), not p^17", () => {
    const seasonLength = WIN_PROJECTION_MODEL.seasonLength;
    const ratings = [84, 87, 88.5, 89.1] as const;

    for (const rating of ratings) {
      const projection = projectWinsFromRating(rating);
      const p = perGameWinProbabilityFromRating(rating);
      expect(projection.perfectSeasonProbability).toBeCloseTo(exactRecordShare(rating, 17), 12);
      expect(projection.expectedWins).toBeCloseTo(seasonLength * p, 12);
      expect(projection.perGameWinProbability).toBe(p);
    }

    expect(projectWinsFromRating(84).perfectSeasonProbability).toBe(0);
    expect(projectWinsFromRating(87).perfectSeasonProbability).toBe(0);
    expect(formatPerfectSeasonChance(projectWinsFromRating(84).perfectSeasonProbability)).toBe("0%");
    expect(formatPerfectSeasonChance(0)).toBe("0%");

    const oldP17At84 =
      perGameWinProbabilityFromRating(84) ** seasonLength;
    expect(oldP17At84).toBeCloseTo(0.071, 2);
    expect(projectWinsFromRating(84).perfectSeasonProbability).not.toBeCloseTo(oldP17At84, 2);

    expect(projectWinsFromRating(88.5).perfectSeasonProbability).toBeCloseTo(0.601998, 4);
    expect(projectWinsFromRating(89.1).perfectSeasonProbability).toBeGreaterThan(
      projectWinsFromRating(88.5).perfectSeasonProbability,
    );
    expect(projectWinsFromRating(89.1).perfectSeasonProbability).toBeLessThan(1);

    for (const rating of [70, 80, 84, 86, 87]) {
      expect(exactRecordShare(rating, 17)).toBe(0);
      expect(projectWinsFromRating(rating).perfectSeasonProbability).toBe(0);
      expect(formatPerfectSeasonChance(projectWinsFromRating(rating).perfectSeasonProbability)).toBe(
        "0%",
      );
    }

    expect(displayedSeasonWins(17, perGameWinProbabilityFromRating(84), SEASON_VARIANCE_K)).toBeLessThan(
      17,
    );
  });
});
