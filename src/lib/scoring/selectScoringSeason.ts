import { isLegitimateScoringSeason } from "./metrics";
import { scorePlayerSeason, type PlayerSeasonScoreResult } from "./playerSeasonScore";
import type { PeerBaselineIndex } from "./peerBaselines";
import type { SeasonStatRecord } from "./types";
import type { LineupSlot, NormalizedPosition } from "@/lib/football/positions";

export interface ScoringSeasonCandidate {
  season: number;
  rawProductionScore: number;
  reliability: number;
  adjustedProductionScore: number;
  selected: boolean;
}

export interface SelectedScoringSeason {
  season: number | null;
  seasonStat: SeasonStatRecord | null;
  score: PlayerSeasonScoreResult;
  candidates: ScoringSeasonCandidate[];
}

/**
 * Pick the strongest legitimate season after reliability adjustment.
 */
export function selectScoringSeason(
  seasons: readonly SeasonStatRecord[],
  scoringPosition: NormalizedPosition,
  baselines: PeerBaselineIndex,
  options?: { lineupSlot?: LineupSlot; cardPositions?: readonly NormalizedPosition[] },
): SelectedScoringSeason {
  const eligible = seasons.filter(isLegitimateScoringSeason);

  if (eligible.length === 0) {
    const fallbackScore = scorePlayerSeason(
      seasons[0] ?? emptySeasonStat(),
      scoringPosition,
      baselines,
      options,
    );
    return {
      season: seasons[0]?.season ?? null,
      seasonStat: seasons[0] ?? null,
      score: fallbackScore,
      candidates: [],
    };
  }

  const scored = eligible.map((seasonStat) => {
    const score = scorePlayerSeason(seasonStat, scoringPosition, baselines, options);
    return { seasonStat, score };
  });

  let best = scored[0]!;
  for (const entry of scored.slice(1)) {
    const adjustedGap =
      entry.score.adjustedProductionScore - best.score.adjustedProductionScore;
    if (adjustedGap > 0.5) {
      best = entry;
      continue;
    }
    if (adjustedGap < -0.5) continue;
  // Tie-break toward more reliable seasons when adjusted scores are close.
    if (entry.score.reliability > best.score.reliability + 0.05) {
      best = entry;
      continue;
    }
    if (
      entry.score.reliability >= best.score.reliability - 0.02 &&
      (entry.seasonStat.games ?? 0) > (best.seasonStat.games ?? 0)
    ) {
      best = entry;
    }
  }

  const selectedSeason = best.seasonStat.season;
  const candidates: ScoringSeasonCandidate[] = scored.map((entry) => ({
    season: entry.seasonStat.season,
    rawProductionScore: entry.score.rawProductionScore,
    reliability: entry.score.reliability,
    adjustedProductionScore: entry.score.adjustedProductionScore,
    selected: entry.seasonStat.season === selectedSeason,
  }));

  return {
    season: selectedSeason,
    seasonStat: best.seasonStat,
    score: best.score,
    candidates,
  };
}

function emptySeasonStat(): SeasonStatRecord {
  return {
    season: 0,
    playerId: 0,
    franchiseId: 0,
    positions: [],
    games: null,
    gamesStarted: null,
    passingYards: null,
    passingTouchdowns: null,
    interceptions: null,
    rushingYards: null,
    rushingAttempts: null,
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
  };
}
