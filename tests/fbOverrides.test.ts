import { describe, expect, it } from "vitest";

import { applyOverridesAndRebuildCards } from "@/data/cards/rebuildFromDatabase";
import {
  applyPositionOverrides,
  loadPositionOverrides,
  type PositionOverride,
} from "@/data/positions/overrides";
import { normalizeRosterPositions } from "@/data/sources/nflverse/positions";

describe("FB override application", () => {
  it("adds season-scoped FB without removing RB", () => {
    const overrides: PositionOverride[] = [
      {
        gsisId: "00-0007565",
        playerName: "Merril Hoge",
        franchiseSlug: "pittsburgh-steelers",
        fromSeason: 1987,
        toSeason: 1989,
        eligiblePositions: ["FB"],
        reason: "test",
      },
    ];

    const inWindow = applyPositionOverrides(["RB"], overrides, {
      gsisId: "00-0007565",
      playerName: "Merril Hoge",
      franchiseSlug: "pittsburgh-steelers",
      season: 1988,
    });
    expect(inWindow.positions.sort()).toEqual(["FB", "RB"]);
    expect(inWindow.applied).toHaveLength(1);

    const outside = applyPositionOverrides(["RB"], overrides, {
      gsisId: "00-0007565",
      playerName: "Merril Hoge",
      franchiseSlug: "pittsburgh-steelers",
      season: 1990,
    });
    expect(outside.positions).toEqual(["RB"]);
    expect(outside.applied).toHaveLength(0);
  });

  it("does not apply FB override to a different franchise", () => {
    const overrides: PositionOverride[] = [
      {
        playerName: "Steve Smith",
        gsisId: "00-0015306",
        franchiseSlug: "las-vegas-raiders",
        fromSeason: 1987,
        toSeason: 1989,
        eligiblePositions: ["FB"],
        reason: "test",
      },
    ];
    const result = applyPositionOverrides(["RB"], overrides, {
      gsisId: "00-0015306",
      playerName: "Steve Smith",
      franchiseSlug: "carolina-panthers",
      season: 1988,
    });
    expect(result.positions).toEqual(["RB"]);
  });

  it("never blanket-maps RB or HB to FB automatically", () => {
    expect(
      normalizeRosterPositions({ position: "RB", depthChartPosition: "RB" }).automatic,
    ).toEqual(["RB"]);
    expect(
      normalizeRosterPositions({ position: "HB", depthChartPosition: null }).automatic,
    ).toEqual(["RB"]);
    expect(
      normalizeRosterPositions({ position: "TE", depthChartPosition: null }).automatic,
    ).toEqual(["TE"]);
  });

  it("still maps depth_chart_position FB alongside RB", () => {
    const result = normalizeRosterPositions({ position: "RB", depthChartPosition: "FB" });
    expect(result.automatic.sort()).toEqual(["FB", "RB"]);
  });

  it("loads committed override file", async () => {
    const loaded = await loadPositionOverrides();
    expect(loaded.length).toBeGreaterThanOrEqual(6);
    expect(loaded.every((row) => row.eligiblePositions.includes("FB"))).toBe(true);
    expect(loaded.every((row) => row.reason.length > 0)).toBe(true);
    expect(typeof applyOverridesAndRebuildCards).toBe("function");
  });
});
