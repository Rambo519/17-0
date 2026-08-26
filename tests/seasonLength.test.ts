import { readFile } from "node:fs/promises";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { PRODUCT_NAME } from "@/lib/brand";
import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { RECORD_REVEAL, recordRevealAt } from "@/lib/results/recordReveal";
import { isPerfectProjectedSeason } from "@/lib/results/tiers";
import { WIN_PROJECTION_MODEL } from "@/lib/scoring/config";
import {
  minimumPerGameProbabilityForProjectedWins,
  projectWinsFromRating,
  ratingThresholdForProjectedWins,
} from "@/lib/scoring/winProjection";

describe("17-game season length", () => {
  it("uses 17 as the authoritative regular-season length", () => {
    expect(REGULAR_SEASON_GAMES).toBe(17);
    expect(WIN_PROJECTION_MODEL.seasonLength).toBe(REGULAR_SEASON_GAMES);
  });

  it("projects wins and losses that always total the season length", () => {
    for (const rating of [20, 45, 58, 62, 73, 82, 88, 90, 93, 96, 100]) {
      const projection = projectWinsFromRating(rating);
      expect(projection.projectedWins + projection.projectedLosses).toBe(REGULAR_SEASON_GAMES);
      expect(projection.projectedWins).toBeGreaterThanOrEqual(0);
      expect(projection.projectedWins).toBeLessThanOrEqual(REGULAR_SEASON_GAMES);
    }
  });

  it("uses seasonLength * p for expected wins", () => {
    const projection = projectWinsFromRating(80);
    expect(projection.expectedWins).toBeCloseTo(
      REGULAR_SEASON_GAMES * projection.perGameWinProbability,
      10,
    );
  });

  it("uses p^17 for perfect-season probability", () => {
    const projection = projectWinsFromRating(80);
    expect(projection.perfectSeasonProbability).toBeCloseTo(
      projection.perGameWinProbability ** 17,
      10,
    );
    expect(projection.perfectSeasonProbability).toBeCloseTo(
      projection.perGameWinProbability ** REGULAR_SEASON_GAMES,
      10,
    );
  });

  it("can project 17-0 only at the extreme elite tail", () => {
    const threshold = ratingThresholdForProjectedWins(REGULAR_SEASON_GAMES);
    expect(threshold).toBeGreaterThan(90);
    expect(projectWinsFromRating(threshold - 1).projectedWins).toBe(16);
    expect(projectWinsFromRating(threshold).projectedWins).toBe(17);
    expect(projectWinsFromRating(threshold).projectedLosses).toBe(0);
    expect(projectWinsFromRating(90).projectedWins).toBeLessThan(17);
    expect(
      projectWinsFromRating(threshold).perGameWinProbability,
    ).toBeGreaterThanOrEqual(minimumPerGameProbabilityForProjectedWins(17));
  });
});

describe("jackpot is 17-0 only", () => {
  it("does not treat 16-1 as a perfect season", () => {
    expect(isPerfectProjectedSeason(16)).toBe(false);
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 16).jackpot).toBe(false);
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 16)).toMatchObject({
      wins: 16,
      losses: 1,
      landed: true,
      jackpot: false,
    });
  });

  it("treats 17-0 as the jackpot season", () => {
    expect(isPerfectProjectedSeason(17)).toBe(true);
    const landed = recordRevealAt(
      RECORD_REVEAL.durationMs,
      REGULAR_SEASON_GAMES,
    );
    expect(landed).toMatchObject({
      wins: 17,
      losses: 0,
      landed: true,
      jackpot: true,
    });
  });

  it("terminates the count-up on a 17-game record", () => {
    expect(recordRevealAt(0, 12)).toMatchObject({ wins: 0, losses: 17 });
    const landed = recordRevealAt(RECORD_REVEAL.durationMs, 12);
    expect(landed.wins + landed.losses).toBe(17);
    expect(PRODUCT_NAME).toBe("17-0");
  });

  it("has no accidental player-facing 16-0 projection labels", async () => {
    const files = [
      "src/components/game/ResultsView.tsx",
      "src/components/game/ModeSelector.tsx",
      "src/components/game/GameHeader.tsx",
      "src/app/layout.tsx",
      "src/app/game/[id]/page.tsx",
      "src/app/game/[id]/results/page.tsx",
      "src/lib/results/tiers.ts",
    ];
    for (const file of files) {
      const source = await readFile(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/16&0|16-0 Chance|16–0 Chance|16 & 0/);
    }
  });
});
