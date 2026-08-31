import { describe, expect, it } from "vitest";

import { LINEUP_SLOTS, type LineupSlot } from "@/lib/football/positions";
import {
  cardIsEligibleForSlot,
  eligibleSlotsForCard,
  isCardSelectable,
  selectableCards,
  usefulPositions,
} from "@/lib/game/eligibility";
import { deriveGameState } from "@/lib/game/gameState";
import type { DraftPickRecord, GameSessionRecord } from "@/lib/game/types";

import { card } from "./helpers/inMemoryGameRepository";

const session: GameSessionRecord = {
  id: "00000000-0000-4000-8000-000000000000",
  status: "ACTIVE",
  mode: "CLASSIC",
  teamSkipRemaining: 1,
  eraSkipRemaining: 1,
  currentFranchiseId: 1,
  currentEraId: 1,
  createdAt: new Date(),
  completedAt: null,
};

function stateWithFilledSlots(slots: LineupSlot[]) {
  const picks: DraftPickRecord[] = slots.map((slot, index) => ({
    roundNumber: index + 1,
    lineupSlot: slot,
    playerId: 900 + index,
    playerTeamEraCardId: 900 + index,
    franchiseId: 1,
    eraId: 1,
    playerName: `Filled ${slot}`,
    franchiseName: "Franchise 1",
    franchiseAbbreviation: "F1",
    eraLabel: "Era 1",
  }));

  return deriveGameState(session, picks);
}

describe("eligibility", () => {
  it("treats WR as useful while either receiver slot is open", () => {
    expect(usefulPositions([...LINEUP_SLOTS])).toEqual(["QB", "RB", "WR", "TE"]);
    expect(usefulPositions(["WR2", "TE"])).toEqual(["WR", "TE"]);
  });

  it("drops WR from useful positions once both receiver slots are filled", () => {
    const state = stateWithFilledSlots(["WR1", "WR2"]);

    expect(state.usefulPositions).toEqual(["QB", "RB", "TE"]);
    expect(isCardSelectable(card({ positions: ["WR"] }), state)).toBe(false);
    expect(isCardSelectable(card({ positions: ["RB", "WR"] }), state)).toBe(true);
  });

  it("keeps a TE-only player out of the RB slot", () => {
    const tightEnd = card({ positions: ["TE"] });

    expect(cardIsEligibleForSlot(tightEnd, "RB1")).toBe(false);
    expect(cardIsEligibleForSlot(tightEnd, "TE")).toBe(true);
    expect(eligibleSlotsForCard(tightEnd, [...LINEUP_SLOTS])).toEqual(["TE"]);
  });

  it("lets a multi-position RB/FB fill either RB slot, but not as FB", () => {
    const dual = card({ positions: ["RB", "FB"] });
    const fbOnly = card({ positions: ["FB"] });

    expect(eligibleSlotsForCard(dual, [...LINEUP_SLOTS])).toEqual(["RB1", "RB2"]);
    expect(eligibleSlotsForCard(dual, ["RB2", "TE"])).toEqual(["RB2"]);
    expect(eligibleSlotsForCard(fbOnly, [...LINEUP_SLOTS])).toEqual([]);
    expect(cardIsEligibleForSlot(fbOnly, "RB1")).toBe(false);
    expect(cardIsEligibleForSlot(fbOnly, "RB2")).toBe(false);
  });

  it("keeps RB useful after one running back is drafted", () => {
    const state = stateWithFilledSlots(["RB1"]);
    const back = card({ positions: ["RB"] });

    expect(state.usefulPositions).toContain("RB");
    expect(eligibleSlotsForCard(back, state.openSlots)).toEqual(["RB2"]);
    expect(isCardSelectable(back, state)).toBe(true);
  });

  it("offers a WR the second receiver slot once the first is taken", () => {
    const receiver = card({ positions: ["WR"] });
    const state = stateWithFilledSlots(["WR1"]);

    expect(eligibleSlotsForCard(receiver, state.openSlots)).toEqual(["WR2"]);
  });

  it("excludes already drafted players and undraftable cards", () => {
    const state = stateWithFilledSlots(["QB"]);
    const drafted = card({ cardId: 900, playerId: 900, positions: ["QB"] });
    const undraftable = card({ positions: ["RB"], draftable: false });
    const available = card({ positions: ["RB"] });

    expect(selectableCards([drafted, undraftable, available], state)).toEqual([available]);
  });
});
