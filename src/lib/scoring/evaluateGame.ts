import { LINEUP_SLOTS } from "@/lib/football/positions";
import { deriveGameState } from "@/lib/game/gameState";
import { buildLineup, isLineupComplete } from "@/lib/game/lineup";

import { evaluateLineup } from "./evaluateLineup";
import { loadRuntimePeerBaselines } from "./loadPeerBaselines";
import type { ScoringRepository } from "./ports";
import type { GameScoringResult } from "./types";

export class ScoringError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScoringError";
  }
}

export async function evaluateCompletedGame(
  repository: ScoringRepository,
  sessionId: string,
): Promise<GameScoringResult> {
  const session = await repository.findSession(sessionId);
  if (!session) {
    throw new ScoringError("Game session not found");
  }
  if (session.status !== "COMPLETE") {
    throw new ScoringError("Game is not complete");
  }

  const picksForState = await repository.listPicks(sessionId);
  const state = deriveGameState(session, picksForState);
  const lineup = buildLineup(state.picks);

  if (!isLineupComplete(lineup)) {
    throw new ScoringError("Lineup is incomplete");
  }

  const picks = LINEUP_SLOTS.map((slot) => {
    const pick = lineup[slot];
    if (!pick) {
      throw new ScoringError(`Missing pick for slot ${slot}`);
    }
    return pick;
  });

  const cardIds = picks.map((pick) => pick.playerTeamEraCardId);
  const [cards, seasonsByCard] = await Promise.all([
    repository.findCards(cardIds),
    repository.loadSeasonStatsForCards(cardIds),
  ]);
  const cardById = new Map(cards.map((card) => [card.cardId, card]));
  const baselines = loadRuntimePeerBaselines();

  const lineupInputs = picks.map((pick) => {
    const card = cardById.get(pick.playerTeamEraCardId);
    if (!card) {
      throw new ScoringError(`Card not found for pick in slot ${pick.lineupSlot}`);
    }
    return {
      lineupSlot: pick.lineupSlot,
      playerId: pick.playerId,
      playerName: pick.playerName,
      franchiseId: pick.franchiseId,
      eraId: pick.eraId,
      cardId: pick.playerTeamEraCardId,
      firstSeason: card.firstSeason,
      lastSeason: card.lastSeason,
      positions: card.positions,
      seasons: seasonsByCard.get(pick.playerTeamEraCardId) ?? [],
    };
  });

  return evaluateLineup(lineupInputs, baselines);
}
