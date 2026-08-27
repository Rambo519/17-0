import { GameRuleError } from "./errors";
import { assertGameActive, loadGameState, type GameState } from "./gameState";
import type { GameRepository } from "./ports";
import {
  buildSpinCombinations,
  chooseSpinCombination,
  withCandidateProduction,
  type Rng,
  type SpinCombination,
  type SpinResult,
} from "./spin";

/**
 * Temporary development QA spin. Replaces only the current franchise+era spin
 * via setCurrentSpin — the same write production SPIN uses — so picks, round,
 * skip remaining, scoring, and eligibility are untouched. Does not go through
 * applySkipSpin.
 */
export interface QaSpinTarget {
  franchiseAbbreviation: string;
  eraLabel: string;
}

export interface QaSpinResult {
  spin: SpinResult;
  combinationCount: number;
}

export interface QaSpinPoolEntry {
  franchiseAbbreviation: string;
  franchiseName: string;
  eraLabel: string;
  candidateCount: number;
}

export interface QaSpinPool {
  combinationCount: number;
  combinations: QaSpinPoolEntry[];
}

export const QA_BALTIMORE_2000S: QaSpinTarget = {
  franchiseAbbreviation: "BAL",
  eraLabel: "2000s",
};

function combinationMatchesTarget(combination: SpinCombination, target: QaSpinTarget): boolean {
  return (
    combination.franchiseAbbreviation.toUpperCase() === target.franchiseAbbreviation.toUpperCase() &&
    combination.eraLabel === target.eraLabel
  );
}

export function findQaSpinCombination(
  combinations: readonly SpinCombination[],
  target: QaSpinTarget,
): SpinCombination | undefined {
  return combinations.find((combination) => combinationMatchesTarget(combination, target));
}

async function toSpinResult(
  repository: GameRepository,
  sessionId: string,
  combination: SpinCombination,
  openSlots: SpinResult["openSlots"],
): Promise<SpinResult> {
  return {
    sessionId,
    franchise: {
      id: combination.franchiseId,
      name: combination.franchiseName,
      abbreviation: combination.franchiseAbbreviation,
    },
    era: { id: combination.eraId, label: combination.eraLabel },
    openSlots,
    candidates: await withCandidateProduction(repository, combination.candidates),
  };
}

async function loadQaSpinPool(
  repository: GameRepository,
  sessionId: string,
): Promise<{ state: GameState; combinations: SpinCombination[] }> {
  const state = await loadGameState(repository, sessionId);
  assertGameActive(state);

  if (state.isComplete) {
    throw new GameRuleError("LINEUP_ALREADY_FULL", "Every lineup slot is already filled.");
  }

  const cards = await repository.listDraftableCards({
    positions: state.usefulPositions,
    excludePlayerIds: state.draftedPlayerIds,
  });

  return { state, combinations: buildSpinCombinations(cards, state) };
}

async function commitQaSpin(
  repository: GameRepository,
  sessionId: string,
  combination: SpinCombination,
  state: GameState,
  combinationCount: number,
): Promise<QaSpinResult> {
  await repository.setCurrentSpin(sessionId, {
    franchiseId: combination.franchiseId,
    eraId: combination.eraId,
  });

  return {
    combinationCount,
    spin: await toSpinResult(repository, sessionId, combination, state.openSlots),
  };
}

/** Unlimited development reroll: same pool + chooser as SPIN, without consuming skips. */
export async function qaRerollSpin(
  repository: GameRepository,
  sessionId: string,
  rng: Rng = Math.random,
): Promise<QaSpinResult> {
  const { state, combinations } = await loadQaSpinPool(repository, sessionId);
  const combination = chooseSpinCombination(combinations, rng);
  return commitQaSpin(repository, sessionId, combination, state, combinations.length);
}

/** Force one valid Team+Era from the real remaining pool. Eligibility is unchanged. */
export async function qaForceSpin(
  repository: GameRepository,
  sessionId: string,
  target: QaSpinTarget,
): Promise<QaSpinResult> {
  const { state, combinations } = await loadQaSpinPool(repository, sessionId);
  const combination = findQaSpinCombination(combinations, target);
  if (!combination) {
    throw new GameRuleError(
      "NO_VALID_SPIN",
      `No legal ${target.franchiseAbbreviation} ${target.eraLabel} combination remains for the open lineup slots.`,
    );
  }
  return commitQaSpin(repository, sessionId, combination, state, combinations.length);
}

export async function qaInspectSpinPool(
  repository: GameRepository,
  sessionId: string,
): Promise<QaSpinPool> {
  const { combinations } = await loadQaSpinPool(repository, sessionId);
  const entries = combinations.map((combination) => ({
    franchiseAbbreviation: combination.franchiseAbbreviation,
    franchiseName: combination.franchiseName,
    eraLabel: combination.eraLabel,
    candidateCount: combination.candidates.length,
  }));
  entries.sort((left, right) => {
    const byTeam = left.franchiseAbbreviation.localeCompare(right.franchiseAbbreviation);
    if (byTeam !== 0) return byTeam;
    return left.eraLabel.localeCompare(right.eraLabel);
  });
  return { combinationCount: entries.length, combinations: entries };
}
