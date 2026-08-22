import { deriveGameState, type GameState } from "./gameState";
import type { GameRepository } from "./ports";

export async function startGame(repository: GameRepository): Promise<GameState> {
  const session = await repository.createSession();
  return deriveGameState(session, []);
}
