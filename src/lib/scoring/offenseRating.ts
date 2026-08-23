import {
  BALANCE_ADJUSTMENT,
  BALANCE_WEIGHT,
  LINEUP_SLOT_WEIGHTS,
} from "./config";
import { clamp } from "./percentile";
import type { DataConfidence, OffenseEvaluation, PlayerEvaluation } from "./types";
import { LINEUP_SLOTS } from "@/lib/football/positions";

function aggregateDataConfidence(players: readonly PlayerEvaluation[]): DataConfidence {
  if (players.some((player) => player.dataConfidence === "LOW")) return "LOW";
  if (players.some((player) => player.dataConfidence === "MEDIUM")) return "MEDIUM";
  return "HIGH";
}

function computeBalanceAdjustment(playerScores: readonly number[]): number {
  if (playerScores.length === 0) return 0;

  const minScore = Math.min(...playerScores);
  let adjustment = 0;

  if (minScore < BALANCE_ADJUSTMENT.weakThreshold) {
    const penalty =
      (BALANCE_ADJUSTMENT.weakThreshold - minScore) * BALANCE_ADJUSTMENT.penaltyFactor;
    adjustment -= Math.min(BALANCE_ADJUSTMENT.maxPenalty, penalty);
  }

  if (minScore >= BALANCE_ADJUSTMENT.strongThreshold) {
    const bonus =
      (minScore - BALANCE_ADJUSTMENT.strongThreshold) * BALANCE_ADJUSTMENT.bonusFactor;
    adjustment += Math.min(BALANCE_ADJUSTMENT.maxBonus, bonus);
  }

  return adjustment;
}

export function evaluateOffense(players: readonly PlayerEvaluation[]): OffenseEvaluation {
  const talentWeightSum = LINEUP_SLOTS.reduce(
    (sum, slot) => sum + LINEUP_SLOT_WEIGHTS[slot],
    0,
  );

  let weightedTalent = 0;
  for (const player of players) {
    weightedTalent += LINEUP_SLOT_WEIGHTS[player.lineupSlot] * player.overall;
  }
  const weightedTalentRating = weightedTalent / talentWeightSum;

  const balanceAdjustment = computeBalanceAdjustment(players.map((player) => player.overall));

  const overallRating = clamp(weightedTalentRating + balanceAdjustment * BALANCE_WEIGHT, 0, 100);

  return {
    overallRating,
    weightedTalentRating,
    balanceAdjustment,
    players: [...players],
    dataConfidence: aggregateDataConfidence(players),
  };
}
