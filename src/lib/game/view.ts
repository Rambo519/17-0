import { LINEUP_SLOTS, positionForSlot, type LineupSlot, type NormalizedPosition } from "@/lib/football/positions";

import type { GameState } from "./gameState";
import type { GameStatus } from "./types";

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
  status: GameStatus;
  isComplete: boolean;
  nextRoundNumber: number;
  openSlots: LineupSlot[];
  usefulPositions: NormalizedPosition[];
  lineup: LineupSlotView[];
}

export function toGameStateView(state: GameState): GameStateView {
  return {
    sessionId: state.sessionId,
    status: state.status,
    isComplete: state.isComplete,
    nextRoundNumber: state.nextRoundNumber,
    openSlots: state.openSlots,
    usefulPositions: state.usefulPositions,
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
