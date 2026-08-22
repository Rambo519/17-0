import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

export const GAME_STATUSES = ["ACTIVE", "COMPLETE"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export interface GameSessionRecord {
  id: string;
  status: GameStatus;
  currentFranchiseId: number | null;
  currentEraId: number | null;
  createdAt: Date;
  completedAt: Date | null;
}

export interface DraftPickRecord {
  roundNumber: number;
  lineupSlot: LineupSlot;
  playerId: number;
  playerTeamEraCardId: number;
  franchiseId: number;
  eraId: number;
  playerName: string;
  franchiseName: string;
  eraLabel: string;
}

/**
 * A player's stint with one franchise in one era, flattened for the engine.
 * `positions` holds every normalized position the card is eligible at.
 */
export interface DraftableCard {
  cardId: number;
  playerId: number;
  playerName: string;
  franchiseId: number;
  franchiseName: string;
  eraId: number;
  eraLabel: string;
  positions: NormalizedPosition[];
  firstSeason: number;
  lastSeason: number;
  representativeSeason: number | null;
  draftable: boolean;
}

export interface SpinTarget {
  franchiseId: number;
  eraId: number;
}

export interface NewPick {
  roundNumber: number;
  lineupSlot: LineupSlot;
  playerId: number;
  playerTeamEraCardId: number;
  franchiseId: number;
  eraId: number;
}
