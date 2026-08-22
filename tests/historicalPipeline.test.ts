import { describe, expect, it } from "vitest";

import { derivePlayerTeamEraCards } from "@/data/cards/buildCards";
import { DRAFTABLE_RULE_SUMMARY, isCardDraftable } from "@/data/draftable";
import {
  applyPositionOverrides,
  findMatchingOverrides,
  type PositionOverride,
} from "@/data/positions/overrides";
import { normalizeRosterPositions } from "@/data/sources/nflverse/positions";

describe("position normalization with depth chart", () => {
  it("maps conservative raw aliases", () => {
    expect(normalizeRosterPositions({ position: "HB", depthChartPosition: null }).primary).toBe(
      "RB",
    );
    expect(normalizeRosterPositions({ position: "FL", depthChartPosition: null }).primary).toBe(
      "WR",
    );
  });

  it("adds FB from depth_chart_position without inventing from every RB", () => {
    const withFb = normalizeRosterPositions({ position: "RB", depthChartPosition: "FB" });
    expect(withFb.automatic.sort()).toEqual(["FB", "RB"]);
    expect(withFb.primary).toBe("RB");

    const rbOnly = normalizeRosterPositions({ position: "RB", depthChartPosition: "RB" });
    expect(rbOnly.automatic).toEqual(["RB"]);
  });

  it("leaves ambiguous labels unmapped", () => {
    const result = normalizeRosterPositions({ position: "E", depthChartPosition: null });
    expect(result.primary).toBeNull();
    expect(result.unmappedLabels).toContain("E");
  });
});

describe("manual position override precedence", () => {
  const overrides: PositionOverride[] = [
    {
      playerName: "Example Back",
      franchiseSlug: "dallas-cowboys",
      fromSeason: 1990,
      toSeason: 1995,
      eligiblePositions: ["RB", "FB"],
      reason: "test override",
    },
  ];

  it("matches and unions override positions after automatic normalization", () => {
    const applied = applyPositionOverrides(["RB"], overrides, {
      gsisId: null,
      playerName: "Example Back",
      franchiseSlug: "dallas-cowboys",
      season: 1992,
    });
    expect(applied.positions.sort()).toEqual(["FB", "RB"]);
    expect(applied.applied).toHaveLength(1);
  });

  it("does not match outside season or franchise bounds", () => {
    expect(
      findMatchingOverrides(overrides, {
        gsisId: null,
        playerName: "Example Back",
        franchiseSlug: "dallas-cowboys",
        season: 1989,
      }),
    ).toHaveLength(0);
  });
});

describe("player/team/era card derivation", () => {
  it("creates one card per franchise and per decade for the same player", () => {
    const cards = derivePlayerTeamEraCards([
      {
        playerId: 1,
        franchiseId: 10,
        seasons: [
          {
            season: 1987,
            eraId: 3,
            positions: ["QB"],
            games: 12,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
          {
            season: 1990,
            eraId: 4,
            positions: ["QB"],
            games: 14,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
      {
        playerId: 1,
        franchiseId: 20,
        seasons: [
          {
            season: 1992,
            eraId: 4,
            positions: ["QB"],
            games: 10,
            rosterStatus: "ACT",
            hasRosterEvidence: true,
          },
        ],
      },
    ]);

    expect(cards).toHaveLength(3);
    expect(cards.filter((card) => card.franchiseId === 10)).toHaveLength(2);
    expect(cards.filter((card) => card.eraId === 4)).toHaveLength(2);
  });

  it("marks non-participating developmental seasons undraftable", () => {
    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [{ games: null, rosterStatus: "DEV", hasRosterEvidence: true }],
      }),
    ).toBe(false);

    expect(
      isCardDraftable({
        positions: ["WR"],
        seasons: [{ games: 3, rosterStatus: "DEV", hasRosterEvidence: true }],
      }),
    ).toBe(true);

    expect(DRAFTABLE_RULE_SUMMARY.toLowerCase()).toContain("games");
  });
});
