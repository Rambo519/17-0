import type { GameScoringResult, PlayerEvaluation } from "./types";

export interface ScoringResultView {
  offenseRating: number;
  weightedTalentRating: number;
  balanceAdjustment: number;
  expectedWins: number;
  projectedWins: number;
  projectedLosses: number;
  perGameWinProbability: number;
  perfectSeasonProbability: number;
  dataConfidence: "HIGH" | "MEDIUM" | "LOW";
  players: Array<{
    playerName: string;
    lineupSlot: string;
    position: string;
    scoringSeason: number | null;
    rawProductionScore: number;
    reliability: number;
    overall: number;
    productionScore: number;
    percentileRank: number;
    dataConfidence: "HIGH" | "MEDIUM" | "LOW";
    metrics: PlayerEvaluation["metrics"];
  }>;
}

export function toScoringResultView(result: GameScoringResult): ScoringResultView {
  return {
    offenseRating: result.offense.overallRating,
    weightedTalentRating: result.offense.weightedTalentRating,
    balanceAdjustment: result.offense.balanceAdjustment,
    expectedWins: result.projection.expectedWins,
    projectedWins: result.projection.projectedWins,
    projectedLosses: result.projection.projectedLosses,
    perGameWinProbability: result.projection.perGameWinProbability,
    perfectSeasonProbability: result.projection.perfectSeasonProbability,
    dataConfidence: result.offense.dataConfidence,
    players: result.offense.players.map((player) => ({
      playerName: player.playerName,
      lineupSlot: player.lineupSlot,
      position: player.normalizedPosition,
      scoringSeason: player.scoringSeason,
      rawProductionScore: player.rawProductionScore,
      reliability: player.reliability,
      overall: player.overall,
      productionScore: player.productionScore,
      percentileRank: player.percentileRank,
      dataConfidence: player.dataConfidence,
      metrics: player.metrics,
    })),
  };
}
