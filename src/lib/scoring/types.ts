import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

export type DataConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MetricKey =
  | "passing_yards"
  | "passing_touchdowns"
  | "interceptions"
  | "rushing_yards"
  | "rushing_touchdowns"
  | "receptions"
  | "receiving_yards"
  | "receiving_touchdowns";

export interface SeasonStatRecord {
  season: number;
  playerId: number;
  franchiseId: number;
  positions: readonly NormalizedPosition[];
  games: number | null;
  gamesStarted: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  interceptions: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
}

export interface MetricEvaluation {
  key: MetricKey;
  rawValue: number | null;
  percentile: number | null;
  weight: number;
}

export interface PlayerEvaluation {
  playerId: number;
  playerName: string;
  lineupSlot: LineupSlot;
  normalizedPosition: NormalizedPosition;
  franchiseId: number;
  eraId: number;
  scoringSeason: number | null;
  overall: number;
  productionScore: number;
  percentileRank: number;
  dataConfidence: DataConfidence;
  metrics: MetricEvaluation[];
}

export interface OffenseEvaluation {
  overallRating: number;
  weightedTalentRating: number;
  balanceAdjustment: number;
  players: PlayerEvaluation[];
  dataConfidence: DataConfidence;
}

export interface WinProjection {
  /** Decimal expected wins across a 16-game season (debugging / calibration). */
  expectedWins: number;
  projectedWins: number;
  projectedLosses: number;
  /**
   * Neutral per-game win probability from the offense model.
   * A game-model estimate, not a claim of real-world certainty.
   */
  perGameWinProbability: number;
  /** Independent-game baseline: perGameWinProbability^16 */
  perfectSeasonProbability: number;
}

export interface GameScoringResult {
  offense: OffenseEvaluation;
  projection: WinProjection;
}

export interface LineupPickInput {
  lineupSlot: LineupSlot;
  playerId: number;
  playerName: string;
  franchiseId: number;
  eraId: number;
  cardId: number;
  firstSeason: number;
  lastSeason: number;
  positions: readonly NormalizedPosition[];
  seasons: readonly SeasonStatRecord[];
}
