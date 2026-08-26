import type { DraftableCard } from "@/lib/game/types";
import type { ScoringRepository } from "@/lib/scoring/ports";
import type { SeasonStatRecord } from "@/lib/scoring/types";

import { createInMemoryGameRepository } from "./inMemoryGameRepository";

export function createInMemoryScoringRepository(
  cards: DraftableCard[],
  seasonsByCard: Map<number, SeasonStatRecord[]>,
  peerSeasons: SeasonStatRecord[],
): ScoringRepository {
  const game = createInMemoryGameRepository(cards);

  return {
    ...game,
    async findCards(cardIds) {
      const found = await Promise.all(cardIds.map((id) => game.findCard(id)));
      return found.filter((card): card is DraftableCard => card != null);
    },
    async loadSeasonStatsForCards(cardIds) {
      const result = new Map<number, SeasonStatRecord[]>();
      for (const cardId of cardIds) {
        result.set(cardId, seasonsByCard.get(cardId) ?? []);
      }
      return result;
    },
    async loadAllSeasonStatsForPeers() {
      return peerSeasons;
    },
  };
}
