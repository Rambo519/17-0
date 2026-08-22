import { getDb } from "@/db/client";
import type { GameRepository } from "@/lib/game/ports";

import { createDrizzleGameRepository } from "./repository/drizzleGameRepository";

/**
 * Composition root for the API layer: the only place that binds the game
 * engine to the real database.
 */
export function getGameRepository(): GameRepository {
  return createDrizzleGameRepository(getDb());
}
