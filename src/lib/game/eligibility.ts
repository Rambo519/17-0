import {
  isPositionEligibleForSlot,
  positionsForSlots,
  type LineupSlot,
  type NormalizedPosition,
} from "@/lib/football/positions";

import type { GameState } from "./gameState";
import type { DraftableCard } from "./types";

/** Normalized positions that can still fill one of the open slots. */
export function usefulPositions(slots: readonly LineupSlot[]): NormalizedPosition[] {
  return positionsForSlots(slots);
}

export function cardIsEligibleForSlot(card: DraftableCard, slot: LineupSlot): boolean {
  return card.positions.some((position) => isPositionEligibleForSlot(position, slot));
}

/** Open slots this card could legally occupy right now. */
export function eligibleSlotsForCard(
  card: DraftableCard,
  openSlots: readonly LineupSlot[],
): LineupSlot[] {
  return openSlots.filter((slot) => cardIsEligibleForSlot(card, slot));
}

/**
 * A card is a legal candidate when it is draftable, its player is unused in
 * this session, and it fits at least one open slot.
 */
export function isCardSelectable(card: DraftableCard, state: GameState): boolean {
  if (!card.draftable) return false;
  if (state.draftedPlayerIds.includes(card.playerId)) return false;
  return eligibleSlotsForCard(card, state.openSlots).length > 0;
}

export function selectableCards(
  cards: readonly DraftableCard[],
  state: GameState,
): DraftableCard[] {
  return cards.filter((card) => isCardSelectable(card, state));
}
