import type { LineupSlot } from "@/lib/football/positions";

import { eligibleSlotsForCard, selectableCards } from "./eligibility";
import { GameRuleError } from "./errors";
import { assertGameActive, loadGameState, type GameState } from "./gameState";
import type { GameRepository } from "./ports";
import type { DraftableCard } from "./types";

export type Rng = () => number;

export interface SpinCandidate {
  card: DraftableCard;
  eligibleSlots: LineupSlot[];
}

export interface SpinCombination {
  franchiseId: number;
  franchiseName: string;
  eraId: number;
  eraLabel: string;
  candidates: SpinCandidate[];
}

export interface SpinResult {
  sessionId: string;
  franchise: { id: number; name: string };
  era: { id: number; label: string };
  openSlots: LineupSlot[];
  candidates: SpinCandidate[];
}

function toCandidate(card: DraftableCard, state: GameState): SpinCandidate {
  return { card, eligibleSlots: eligibleSlotsForCard(card, state.openSlots) };
}

/**
 * Buckets legal candidates by franchise + era. A combination only survives if
 * it contains at least one card that can fill an open slot, which is what
 * guarantees a spin is never a dead end.
 */
export function buildSpinCombinations(
  cards: readonly DraftableCard[],
  state: GameState,
): SpinCombination[] {
  const combinations = new Map<string, SpinCombination>();

  for (const card of selectableCards(cards, state)) {
    const key = `${card.franchiseId}:${card.eraId}`;
    let combination = combinations.get(key);

    if (!combination) {
      combination = {
        franchiseId: card.franchiseId,
        franchiseName: card.franchiseName,
        eraId: card.eraId,
        eraLabel: card.eraLabel,
        candidates: [],
      };
      combinations.set(key, combination);
    }

    combination.candidates.push(toCandidate(card, state));
  }

  return [...combinations.values()];
}

export function chooseSpinCombination(
  combinations: readonly SpinCombination[],
  rng: Rng = Math.random,
): SpinCombination {
  if (combinations.length === 0) {
    throw new GameRuleError(
      "NO_VALID_SPIN",
      "No franchise and era combination contains a legal player for the open lineup slots.",
    );
  }

  const index = Math.min(Math.floor(rng() * combinations.length), combinations.length - 1);
  return combinations[index]!;
}

/**
 * Rolls a franchise + era for the session and returns the players that can
 * legally be drafted from it. The chosen spin is stored on the session so the
 * subsequent pick can be validated against it server-side.
 */
export async function spinGame(
  repository: GameRepository,
  sessionId: string,
  rng: Rng = Math.random,
): Promise<SpinResult> {
  const state = await loadGameState(repository, sessionId);
  assertGameActive(state);

  if (state.isComplete) {
    throw new GameRuleError("LINEUP_ALREADY_FULL", "Every lineup slot is already filled.");
  }

  const cards = await repository.listDraftableCards({
    positions: state.usefulPositions,
    excludePlayerIds: state.draftedPlayerIds,
  });

  const combination = chooseSpinCombination(buildSpinCombinations(cards, state), rng);

  await repository.setCurrentSpin(sessionId, {
    franchiseId: combination.franchiseId,
    eraId: combination.eraId,
  });

  return {
    sessionId,
    franchise: { id: combination.franchiseId, name: combination.franchiseName },
    era: { id: combination.eraId, label: combination.eraLabel },
    openSlots: state.openSlots,
    candidates: combination.candidates,
  };
}

/**
 * Re-reads the candidates for a spin that is already stored on the session, so
 * a page reload can restore the board without re-rolling.
 */
export async function loadCurrentSpin(
  repository: GameRepository,
  state: GameState,
): Promise<SpinResult | null> {
  if (!state.currentSpin || state.isComplete) return null;

  const cards = await repository.listDraftableCards({
    positions: state.usefulPositions,
    excludePlayerIds: state.draftedPlayerIds,
    franchiseId: state.currentSpin.franchiseId,
    eraId: state.currentSpin.eraId,
  });

  const candidates = selectableCards(cards, state).map((card) => toCandidate(card, state));
  const first = candidates[0];
  if (!first) return null;

  return {
    sessionId: state.sessionId,
    franchise: { id: first.card.franchiseId, name: first.card.franchiseName },
    era: { id: first.card.eraId, label: first.card.eraLabel },
    openSlots: state.openSlots,
    candidates,
  };
}
