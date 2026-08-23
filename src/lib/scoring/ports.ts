import type { GameRepository } from "@/lib/game/ports";
import type { DraftableCard, GameSessionRecord } from "@/lib/game/types";

import type { SeasonStatRecord } from "./types";

export interface ScoringRepository extends GameRepository {
  findSession(sessionId: string): Promise<GameSessionRecord | null>;
  findCards(cardIds: readonly number[]): Promise<DraftableCard[]>;
  loadSeasonStatsForCards(cardIds: readonly number[]): Promise<Map<number, SeasonStatRecord[]>>;
  loadAllSeasonStatsForPeers(): Promise<SeasonStatRecord[]>;
}
