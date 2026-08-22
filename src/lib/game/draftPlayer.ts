import { LINEUP_SLOT_COUNT, type LineupSlot } from "@/lib/football/positions";

import { cardIsEligibleForSlot } from "./eligibility";
import { GameRuleError } from "./errors";
import { assertGameActive, loadGameState, type GameState } from "./gameState";
import { isSlotOpen } from "./lineup";
import type { GameRepository } from "./ports";
import type { DraftableCard, NewPick } from "./types";

export interface DraftPlayerInput {
  sessionId: string;
  playerTeamEraCardId: number;
  lineupSlot: LineupSlot;
}

export interface DraftPlayerResult {
  pick: NewPick;
  state: GameState;
  completed: boolean;
}

/**
 * All draft rules, checked server-side against stored state. The UI is free to
 * hide illegal options but is never trusted to enforce them.
 */
export function validateDraft(
  state: GameState,
  card: DraftableCard,
  lineupSlot: LineupSlot,
): void {
  assertGameActive(state);

  if (!state.currentSpin) {
    throw new GameRuleError("NO_ACTIVE_SPIN", "Spin before drafting a player.");
  }

  if (!card.draftable) {
    throw new GameRuleError("CARD_NOT_DRAFTABLE", `Card ${card.cardId} is not draftable.`);
  }

  if (
    card.franchiseId !== state.currentSpin.franchiseId ||
    card.eraId !== state.currentSpin.eraId
  ) {
    throw new GameRuleError(
      "SPIN_MISMATCH",
      `${card.playerName} does not belong to the current franchise and era spin.`,
    );
  }

  if (!isSlotOpen(state.lineup, lineupSlot)) {
    throw new GameRuleError("SLOT_ALREADY_FILLED", `Lineup slot ${lineupSlot} is already filled.`);
  }

  if (state.draftedPlayerIds.includes(card.playerId)) {
    throw new GameRuleError(
      "PLAYER_ALREADY_DRAFTED",
      `${card.playerName} has already been drafted in this game.`,
    );
  }

  if (!cardIsEligibleForSlot(card, lineupSlot)) {
    throw new GameRuleError(
      "POSITION_NOT_ELIGIBLE",
      `${card.playerName} (${card.positions.join("/")}) cannot fill ${lineupSlot}.`,
    );
  }
}

export async function draftPlayer(
  repository: GameRepository,
  input: DraftPlayerInput,
): Promise<DraftPlayerResult> {
  const state = await loadGameState(repository, input.sessionId);

  const card = await repository.findCard(input.playerTeamEraCardId);
  if (!card) {
    throw new GameRuleError("CARD_NOT_FOUND", `Card ${input.playerTeamEraCardId} does not exist.`);
  }

  validateDraft(state, card, input.lineupSlot);

  const pick: NewPick = {
    roundNumber: state.nextRoundNumber,
    lineupSlot: input.lineupSlot,
    playerId: card.playerId,
    playerTeamEraCardId: card.cardId,
    franchiseId: card.franchiseId,
    eraId: card.eraId,
  };

  const completed = state.picks.length + 1 === LINEUP_SLOT_COUNT;

  await repository.commitPick({ sessionId: input.sessionId, pick, complete: completed });

  const nextState = await loadGameState(repository, input.sessionId);
  return { pick, state: nextState, completed };
}
