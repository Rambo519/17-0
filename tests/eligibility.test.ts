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
    eraLabel: "Era 1",
  }));

  return deriveGameState(session, picks);
}

describe("eligibility", () => {
  it("treats WR as useful while either receiver slot is open", () => {
    expect(usefulPositions([...LINEUP_SLOTS])).toEqual(["QB", "RB", "FB", "WR", "TE"]);
    expect(usefulPositions(["WR2", "TE"])).toEqual(["WR", "TE"]);
  });

  it("drops WR from useful positions once both receiver slots are filled", () => {
    const state = stateWithFilledSlots(["WR1", "WR2"]);

    expect(state.usefulPositions).toEqual(["QB", "RB", "FB", "TE"]);
    expect(isCardSelectable(card({ positions: ["WR"] }), state)).toBe(false);
    expect(isCardSelectable(card({ positions: ["RB", "WR"] }), state)).toBe(true);
  });

  it("keeps a TE-only player out of the RB slot", () => {
    const tightEnd = card({ positions: ["TE"] });

    expect(cardIsEligibleForSlot(tightEnd, "RB")).toBe(false);
    expect(cardIsEligibleForSlot(tightEnd, "TE")).toBe(true);
    expect(eligibleSlotsForCard(tightEnd, [...LINEUP_SLOTS])).toEqual(["TE"]);
  });

  it("lets a multi-position RB/FB fill either slot", () => {
    const dual = card({ positions: ["RB", "FB"] });

    expect(eligibleSlotsForCard(dual, [...LINEUP_SLOTS])).toEqual(["RB", "FB"]);
    expect(eligibleSlotsForCard(dual, ["FB", "TE"])).toEqual(["FB"]);
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
