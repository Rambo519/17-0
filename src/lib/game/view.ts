import { LINEUP_SLOTS, positionForSlot, type LineupSlot, type NormalizedPosition } from "@/lib/football/positions";

import type { GameState } from "./gameState";
import type { GameMode, GameStatus } from "./types";

/**
 * JSON-safe projection of game state for API responses and the dev screen.
 */
export interface LineupSlotView {
  slot: LineupSlot;
  accepts: NormalizedPosition;
  filled: boolean;
  player: {
    playerId: number;
    playerName: string;
    franchiseName: string;
    eraLabel: string;
    roundNumber: number;
  } | null;
}

export interface GameStateView {
  sessionId: string;
  mode: GameMode;
  status: GameStatus;
  isComplete: boolean;
  /** Current round (1–6). */
  roundNumber: number;
  /** Next pick round number (1–7); kept for Phase 1 callers. */
  nextRoundNumber: number;
  openSlots: LineupSlot[];
  usefulPositions: NormalizedPosition[];
  teamSkipRemaining: number;
  eraSkipRemaining: number;
  lineup: LineupSlotView[];
}

export function toGameStateView(state: GameState): GameStateView {
  return {
    sessionId: state.sessionId,
    mode: state.mode,
    status: state.status,
    isComplete: state.isComplete,
    roundNumber: state.roundNumber,
    nextRoundNumber: state.nextRoundNumber,
    openSlots: state.openSlots,
    usefulPositions: state.usefulPositions,
    teamSkipRemaining: state.teamSkipRemaining,
    eraSkipRemaining: state.eraSkipRemaining,
    lineup: LINEUP_SLOTS.map((slot) => {
      const pick = state.lineup[slot];
      return {
        slot,
        accepts: positionForSlot(slot),
        filled: pick !== null,
        player: pick
          ? {
              playerId: pick.playerId,
              playerName: pick.playerName,
              franchiseName: pick.franchiseName,
              eraLabel: pick.eraLabel,
              roundNumber: pick.roundNumber,
            }
          : null,
      };
    }),
  };
}
