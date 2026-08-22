import { describe, expect, it } from "vitest";

import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { SpinCandidate } from "@/lib/game/spin";
import type { CardProduction } from "@/lib/game/types";
import {
  classicProductionStats,
  highlightedSlotsForCandidate,
  shouldShowClassicStats,
  slotDisplayLabel,
  userFacingError,
} from "@/lib/game/uiHelpers";

function candidate(overrides: Partial<SpinCandidate["card"]> & { eligibleSlots: SpinCandidate["eligibleSlots"] }): SpinCandidate {
  return {
    eligibleSlots: overrides.eligibleSlots,
    card: {
      cardId: 1,
      playerId: 1,
      playerName: "Test Player",
      franchiseId: 1,
      franchiseName: "Test Franchise",
      franchiseAbbreviation: "TST",
      eraId: 1,
      eraLabel: "1980s",
      positions: ["RB", "FB"],
      firstSeason: 1980,
      lastSeason: 1985,
      representativeSeason: null,
      draftable: true,
      production: EMPTY_PRODUCTION,
      ...overrides,
    },
  };
}

describe("uiHelpers", () => {
  it("highlights only open eligible slots for a selected candidate", () => {
    const selected = candidate({ eligibleSlots: ["RB", "FB"], positions: ["RB", "FB"] });
    expect(highlightedSlotsForCandidate(selected, ["QB", "RB", "WR1"])).toEqual(["RB"]);
    expect(highlightedSlotsForCandidate(selected, ["FB"])).toEqual(["FB"]);
    expect(highlightedSlotsForCandidate(null, ["RB", "FB"])).toEqual([]);
  });

  it("keeps WR1 and WR2 as distinct highlight targets", () => {
    const wr = candidate({ eligibleSlots: ["WR1", "WR2"], positions: ["WR"] });
    expect(highlightedSlotsForCandidate(wr, ["WR1", "WR2", "TE"])).toEqual(["WR1", "WR2"]);
    expect(highlightedSlotsForCandidate(wr, ["WR2"])).toEqual(["WR2"]);
  });

  it("displays WR for both receiver slots", () => {
    expect(slotDisplayLabel("WR1")).toBe("WR");
    expect(slotDisplayLabel("WR2")).toBe("WR");
    expect(slotDisplayLabel("QB")).toBe("QB");
  });

  it("shows Classic stats only in CLASSIC mode", () => {
    expect(shouldShowClassicStats("CLASSIC")).toBe(true);
    expect(shouldShowClassicStats("IQ")).toBe(false);
  });

  it("builds position-aware Classic production rows with dashes for missing values", () => {
    const production: CardProduction = {
      ...EMPTY_PRODUCTION,
      games: 48,
      passingYards: 12000,
      passingTouchdowns: null,
    };
    const qb = classicProductionStats(["QB"], production);
    expect(qb.map((row) => row.label)).toEqual(["G", "Pass Yds", "Pass TD", "Rush Yds"]);
    expect(qb.find((row) => row.label === "Pass TD")?.value).toBe("—");
  });

  it("maps skip and draft failures to user-facing copy", () => {
    expect(userFacingError("NO_VALID_TEAM_SKIP", "x")).toBe(
      "No valid alternate team is available.",
    );
    expect(userFacingError("NO_VALID_ERA_SKIP", "x")).toBe(
      "No valid alternate era is available.",
    );
    expect(userFacingError("SLOT_ALREADY_FILLED", "x")).toBe(
      "That position has already been filled.",
    );
    expect(userFacingError("SPIN_MISMATCH", "x")).toBe("This player is no longer available.");
  });
});
