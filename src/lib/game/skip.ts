import { GameRuleError } from "./errors";
import { assertGameActive, loadGameState } from "./gameState";
import type { GameRepository } from "./ports";
import {
  buildSpinCombinations,
  chooseSpinCombination,
  type Rng,
  type SpinResult,
} from "./spin";

function toSpinResult(
  sessionId: string,
  combination: {
    franchiseId: number;
    franchiseName: string;
    eraId: number;
    eraLabel: string;
    candidates: SpinResult["candidates"];
  },
  openSlots: SpinResult["openSlots"],
): SpinResult {
  return {
    sessionId,
    franchise: { id: combination.franchiseId, name: combination.franchiseName },
    era: { id: combination.eraId, label: combination.eraLabel },
    openSlots,
    candidates: combination.candidates,
  };
}

/**
 * Team Skip: keep the current era, roll a different franchise that still has a
 * legal undrafted candidate for the open slots. Consumes the team's one skip.
 */
export async function teamSkipGame(
  repository: GameRepository,
  sessionId: string,
  rng: Rng = Math.random,
): Promise<SpinResult> {
  const state = await loadGameState(repository, sessionId);
  assertGameActive(state);

  if (state.isComplete) {
    throw new GameRuleError("LINEUP_ALREADY_FULL", "Every lineup slot is already filled.");
  }
  if (!state.currentSpin) {
    throw new GameRuleError("NO_ACTIVE_SPIN", "Team Skip requires an active spin.");
  }
  if (state.teamSkipRemaining <= 0) {
    throw new GameRuleError("NO_TEAM_SKIP_REMAINING", "Team Skip has already been used.");
  }

  const current = state.currentSpin;
  const cards = await repository.listDraftableCards({
    positions: state.usefulPositions,
    excludePlayerIds: state.draftedPlayerIds,
    eraId: current.eraId,
  });

  const alternatives = buildSpinCombinations(cards, state).filter(
    (combo) => combo.franchiseId !== current.franchiseId && combo.eraId === current.eraId,
  );

  if (alternatives.length === 0) {
    throw new GameRuleError(
      "NO_VALID_TEAM_SKIP",
      "No other franchise in this era has a legal candidate for the open slots.",
    );
  }

  const combination = chooseSpinCombination(alternatives, rng);

  await repository.applySkipSpin({
    sessionId,
    kind: "TEAM",
    franchiseId: combination.franchiseId,
    eraId: combination.eraId,
  });

  return toSpinResult(sessionId, combination, state.openSlots);
}

/**
 * Era Skip: keep the current franchise, roll a different era where that
 * franchise has a legal undrafted candidate. Consumes the era's one skip.
 */
export async function eraSkipGame(
  repository: GameRepository,
  sessionId: string,
  rng: Rng = Math.random,
): Promise<SpinResult> {
  const state = await loadGameState(repository, sessionId);
  assertGameActive(state);

  if (state.isComplete) {
    throw new GameRuleError("LINEUP_ALREADY_FULL", "Every lineup slot is already filled.");
  }
  if (!state.currentSpin) {
    throw new GameRuleError("NO_ACTIVE_SPIN", "Era Skip requires an active spin.");
  }
  if (state.eraSkipRemaining <= 0) {
    throw new GameRuleError("NO_ERA_SKIP_REMAINING", "Era Skip has already been used.");
  }

  const current = state.currentSpin;
  const cards = await repository.listDraftableCards({
    positions: state.usefulPositions,
    excludePlayerIds: state.draftedPlayerIds,
    franchiseId: current.franchiseId,
  });

  const alternatives = buildSpinCombinations(cards, state).filter(
    (combo) => combo.eraId !== current.eraId && combo.franchiseId === current.franchiseId,
  );

  if (alternatives.length === 0) {
    throw new GameRuleError(
      "NO_VALID_ERA_SKIP",
      "No other era for this franchise has a legal candidate for the open slots.",
    );
  }

  const combination = chooseSpinCombination(alternatives, rng);

  await repository.applySkipSpin({
    sessionId,
    kind: "ERA",
    franchiseId: combination.franchiseId,
    eraId: combination.eraId,
  });

  return toSpinResult(sessionId, combination, state.openSlots);
}
