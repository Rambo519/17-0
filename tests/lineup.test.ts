import { describe, expect, it } from "vitest";

import { LINEUP_SLOTS, positionForSlot, slotsForPosition } from "@/lib/football/positions";
import {
  buildLineup,
  createEmptyLineup,
  filledSlots,
  isLineupComplete,
  openSlots,
} from "@/lib/game/lineup";
import type { DraftPickRecord } from "@/lib/game/types";

function pick(overrides: Partial<DraftPickRecord>): DraftPickRecord {
  return {
    roundNumber: 1,
    lineupSlot: "QB",
    playerId: 1,
    playerTeamEraCardId: 1,
    franchiseId: 1,
    eraId: 1,
    playerName: "Dev Player",
    franchiseName: "Dev Franchise",
    franchiseAbbreviation: "DEV",
    eraLabel: "1980s",
    ...overrides,
  };
}

describe("lineup", () => {
  it("has exactly the six I-formation slots", () => {
    expect([...LINEUP_SLOTS]).toEqual(["QB", "RB", "FB", "WR1", "WR2", "TE"]);
  });

  it("starts a new game with all six slots empty", () => {
    const lineup = createEmptyLineup();
    expect(openSlots(lineup)).toEqual(["QB", "RB", "FB", "WR1", "WR2", "TE"]);
    expect(filledSlots(lineup)).toEqual([]);
    expect(isLineupComplete(lineup)).toBe(false);
  });

  it("maps both receiver slots to the WR position", () => {
    expect(positionForSlot("WR1")).toBe("WR");
    expect(positionForSlot("WR2")).toBe("WR");
    expect(slotsForPosition("WR")).toEqual(["WR1", "WR2"]);
    expect(slotsForPosition("TE")).toEqual(["TE"]);
  });

  it("reports open and filled slots from picks", () => {
    const lineup = buildLineup([
      pick({ roundNumber: 1, lineupSlot: "QB", playerId: 1 }),
      pick({ roundNumber: 2, lineupSlot: "WR1", playerId: 2 }),
    ]);

    expect(filledSlots(lineup)).toEqual(["QB", "WR1"]);
    expect(openSlots(lineup)).toEqual(["RB", "FB", "WR2", "TE"]);
    expect(isLineupComplete(lineup)).toBe(false);
  });

  it("is complete only when all six slots are filled", () => {
    const lineup = buildLineup(
      LINEUP_SLOTS.map((slot, index) =>
        pick({ roundNumber: index + 1, lineupSlot: slot, playerId: index + 1 }),
      ),
    );

    expect(isLineupComplete(lineup)).toBe(true);
    expect(openSlots(lineup)).toEqual([]);
  });
});
