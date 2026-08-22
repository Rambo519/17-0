import { deriveGameState, type GameState } from "./gameState";
import type { GameRepository } from "./ports";
import type { GameMode } from "./types";

export interface StartGameInput {
  mode: GameMode;
}

export async function startGame(
  repository: GameRepository,
  input: StartGameInput,
): Promise<GameState> {
  const session = await repository.createSession({ mode: input.mode });
  return deriveGameState(session, []);
}
