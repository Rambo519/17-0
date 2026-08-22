import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

export const GAME_STATUSES = ["ACTIVE", "COMPLETE"] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export const GAME_MODES = ["CLASSIC", "IQ"] as const;

export type GameMode = (typeof GAME_MODES)[number];

export function isGameMode(value: string): value is GameMode {
  return (GAME_MODES as readonly string[]).includes(value);
}

export interface GameSessionRecord {
  id: string;
  status: GameStatus;
  mode: GameMode;
  teamSkipRemaining: number;
  eraSkipRemaining: number;
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
  franchiseAbbreviation: string;
  eraLabel: string;
}

/**
 * Aggregated production for a card's franchise stint inside its era window.
 * Null means the source never recorded that value (distinct from zero).
 */
export interface CardProduction {
  games: number | null;
  passingYards: number | null;
  passingTouchdowns: number | null;
  rushingYards: number | null;
  rushingTouchdowns: number | null;
  receptions: number | null;
  receivingYards: number | null;
  receivingTouchdowns: number | null;
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
  franchiseAbbreviation: string;
  eraId: number;
  eraLabel: string;
  positions: NormalizedPosition[];
  firstSeason: number;
  lastSeason: number;
  representativeSeason: number | null;
  draftable: boolean;
  /** Era-window totals for Classic mode display. */
  production: CardProduction;
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
