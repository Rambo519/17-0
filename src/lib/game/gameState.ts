import { positionsForSlots, type LineupSlot, type NormalizedPosition } from "@/lib/football/positions";

import { GameRuleError } from "./errors";
import { buildLineup, filledSlots, isLineupComplete, openSlots, type Lineup } from "./lineup";
import type { GameRepository } from "./ports";
import type { DraftPickRecord, GameSessionRecord, GameStatus, SpinTarget } from "./types";

export interface GameState {
  sessionId: string;
  status: GameStatus;
  lineup: Lineup;
  picks: DraftPickRecord[];
  openSlots: LineupSlot[];
  filledSlots: LineupSlot[];
  draftedPlayerIds: number[];
  /** Normalized positions that can still fill something. */
  usefulPositions: NormalizedPosition[];
  currentSpin: SpinTarget | null;
  nextRoundNumber: number;
  isComplete: boolean;
}

export function deriveGameState(
  session: GameSessionRecord,
  picks: readonly DraftPickRecord[],
): GameState {
  const ordered = [...picks].sort((a, b) => a.roundNumber - b.roundNumber);
  const lineup = buildLineup(ordered);
  const open = openSlots(lineup);

  const currentSpin =
    session.currentFranchiseId !== null && session.currentEraId !== null
      ? { franchiseId: session.currentFranchiseId, eraId: session.currentEraId }
      : null;

  return {
    sessionId: session.id,
    status: session.status,
    lineup,
    picks: ordered,
    openSlots: open,
    filledSlots: filledSlots(lineup),
    draftedPlayerIds: ordered.map((pick) => pick.playerId),
    usefulPositions: positionsForSlots(open),
    currentSpin,
    nextRoundNumber: ordered.length + 1,
    isComplete: isLineupComplete(lineup),
  };
}

export async function loadGameState(
  repository: GameRepository,
  sessionId: string,
): Promise<GameState> {
  const session = await repository.findSession(sessionId);
  if (!session) {
    throw new GameRuleError("SESSION_NOT_FOUND", `Game session ${sessionId} does not exist.`);
  }

  const picks = await repository.listPicks(sessionId);
  return deriveGameState(session, picks);
}

export function assertGameActive(state: GameState): void {
  if (state.status !== "ACTIVE") {
    throw new GameRuleError("GAME_NOT_ACTIVE", `Game ${state.sessionId} is ${state.status}.`);
  }
}
