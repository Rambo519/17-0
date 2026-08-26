import type { LineupSlot } from "@/lib/football/positions";
import { positionForSlot } from "@/lib/football/positions";
import { sortCandidatesAlphabetically } from "@/lib/game/candidateOrder";
import { comparePlayerNames } from "@/lib/game/playerName";
import type { SpinCandidate, SpinResult } from "@/lib/game/spin";
import type { GameMode } from "@/lib/game/types";
import { buildPeerBaselineIndex, type PeerBaselineIndex } from "@/lib/scoring/peerBaselines";
import type { ScoringRepository } from "@/lib/scoring/ports";
import { evaluateLineupPick } from "@/lib/scoring/playerEvaluation";
import type { LineupPickInput, SeasonStatRecord } from "@/lib/scoring/types";

let cachedBaselines: PeerBaselineIndex | null = null;

export function resetCandidateRankingCacheForTests(): void {
  cachedBaselines = null;
}

function shouldCachePeerBaselines(): boolean {
  return !process.env.VITEST;
}

async function peerBaselines(repository: ScoringRepository): Promise<PeerBaselineIndex> {
  if (shouldCachePeerBaselines() && cachedBaselines) return cachedBaselines;
  const baselines = buildPeerBaselineIndex(await repository.loadAllSeasonStatsForPeers());
  if (shouldCachePeerBaselines()) cachedBaselines = baselines;
  return baselines;
}

function rankingSlots(candidate: SpinCandidate): LineupSlot[] {
  const slots = candidate.eligibleSlots.length > 0 ? candidate.eligibleSlots : [];
  const seen = new Set<string>();
  const unique: LineupSlot[] = [];
  for (const slot of slots) {
    const position = positionForSlot(slot);
    if (seen.has(position)) continue;
    seen.add(position);
    unique.push(slot);
  }
  return unique;
}

export function evaluateCandidateOverall(
  candidate: SpinCandidate,
  seasons: readonly SeasonStatRecord[],
  baselines: PeerBaselineIndex,
): number {
  const slots = rankingSlots(candidate);
  if (slots.length === 0) {
    return Number.NEGATIVE_INFINITY;
  }

  let best = Number.NEGATIVE_INFINITY;
  for (const slot of slots) {
    const pick: LineupPickInput = {
      lineupSlot: slot,
      playerId: candidate.card.playerId,
      playerName: candidate.card.playerName,
      franchiseId: candidate.card.franchiseId,
      eraId: candidate.card.eraId,
      cardId: candidate.card.cardId,
      firstSeason: candidate.card.firstSeason,
      lastSeason: candidate.card.lastSeason,
      positions: candidate.card.positions,
      seasons,
    };
    const overall = evaluateLineupPick(pick, baselines).overall;
    if (overall > best) best = overall;
  }
  return best;
}

export function sortCandidatesByEvaluation(
  candidates: readonly SpinCandidate[],
  overallByCardId: ReadonlyMap<number, number>,
): SpinCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftScore = overallByCardId.get(left.card.cardId) ?? Number.NEGATIVE_INFINITY;
    const rightScore = overallByCardId.get(right.card.cardId) ?? Number.NEGATIVE_INFINITY;
    if (rightScore !== leftScore) return rightScore - leftScore;
    const byName = comparePlayerNames(left.card.playerName, right.card.playerName);
    if (byName !== 0) return byName;
    return left.card.cardId - right.card.cardId;
  });
}

export async function orderSpinCandidates(
  repository: ScoringRepository,
  mode: GameMode,
  candidates: readonly SpinCandidate[],
): Promise<SpinCandidate[]> {
  if (candidates.length <= 1) return [...candidates];

  if (mode !== "CLASSIC") {
    return sortCandidatesAlphabetically(candidates);
  }

  const baselines = await peerBaselines(repository);
  const seasonsByCard = await repository.loadSeasonStatsForCards(
    candidates.map((candidate) => candidate.card.cardId),
  );
  const overallByCardId = new Map<number, number>();
  for (const candidate of candidates) {
    overallByCardId.set(
      candidate.card.cardId,
      evaluateCandidateOverall(
        candidate,
        seasonsByCard.get(candidate.card.cardId) ?? [],
        baselines,
      ),
    );
  }
  return sortCandidatesByEvaluation(candidates, overallByCardId);
}

export async function orderSpinResult(
  repository: ScoringRepository,
  mode: GameMode,
  spin: SpinResult | null,
): Promise<SpinResult | null> {
  if (!spin) return null;
  return {
    ...spin,
    candidates: await orderSpinCandidates(repository, mode, spin.candidates),
  };
}
