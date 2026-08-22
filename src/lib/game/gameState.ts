import { positionsForSlots, type LineupSlot, type NormalizedPosition } from "@/lib/football/positions";

import { GameRuleError } from "./errors";
import { buildLineup, filledSlots, isLineupComplete, openSlots, type Lineup } from "./lineup";
import type { GameRepository } from "./ports";
import type {
  DraftPickRecord,
  GameMode,
  GameSessionRecord,
  GameStatus,
  SpinTarget,
} from "./types";

export interface GameState {
  sessionId: string;
  status: GameStatus;
  mode: GameMode;
  teamSkipRemaining: number;
  eraSkipRemaining: number;
  lineup: Lineup;
  picks: DraftPickRecord[];
  openSlots: LineupSlot[];
  filledSlots: LineupSlot[];
  draftedPlayerIds: number[];
  /** Normalized positions that can still fill something. */
  usefulPositions: NormalizedPosition[];
  currentSpin: SpinTarget | null;
  /** 1–6 while drafting; 7 after the sixth pick (lineup complete). */
  nextRoundNumber: number;
  /** Current round to play (1–6); equals nextRoundNumber while ACTIVE. */
  roundNumber: number;
  isComplete: boolean;
}

export function deriveGameState(
  session: GameSessionRecord,
  picks: readonly DraftPickRecord[],
): GameState {
  const ordered = [...picks].sort((a, b) => a.roundNumber - b.roundNumber);
  const lineup = buildLineup(ordered);
  const open = openSlots(lineup);
  const nextRoundNumber = ordered.length + 1;
  const complete = isLineupComplete(lineup);

  const currentSpin =
    session.currentFranchiseId !== null && session.currentEraId !== null
      ? { franchiseId: session.currentFranchiseId, eraId: session.currentEraId }
      : null;

  return {
    sessionId: session.id,
    status: session.status,
    mode: session.mode,
    teamSkipRemaining: session.teamSkipRemaining,
    eraSkipRemaining: session.eraSkipRemaining,
    lineup,
    picks: ordered,
    openSlots: open,
    filledSlots: filledSlots(lineup),
    draftedPlayerIds: ordered.map((pick) => pick.playerId),
    usefulPositions: positionsForSlots(open),
    currentSpin,
    nextRoundNumber,
    roundNumber: complete ? Math.min(nextRoundNumber - 1, 6) : nextRoundNumber,
    isComplete: complete,
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
