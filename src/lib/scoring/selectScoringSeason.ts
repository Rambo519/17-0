import { isLegitimateScoringSeason } from "./metrics";
import { scorePlayerSeason } from "./playerSeasonScore";
import type { PeerBaselineIndex } from "./peerBaselines";
import type { SeasonStatRecord } from "./types";
import type { NormalizedPosition } from "@/lib/football/positions";

export interface SelectedScoringSeason {
  season: number | null;
  seasonStat: SeasonStatRecord | null;
  score: ReturnType<typeof scorePlayerSeason>;
}

/**
 * Pick the strongest legitimate single season within the card's franchise-era window.
 */
export function selectScoringSeason(
  seasons: readonly SeasonStatRecord[],
  scoringPosition: NormalizedPosition,
  baselines: PeerBaselineIndex,
): SelectedScoringSeason {
  const eligible = seasons.filter(isLegitimateScoringSeason);

  if (eligible.length === 0) {
    const fallbackScore = scorePlayerSeason(
      seasons[0] ?? emptySeasonStat(),
      scoringPosition,
      baselines,
    );
    return {
      season: seasons[0]?.season ?? null,
      seasonStat: seasons[0] ?? null,
      score: fallbackScore,
    };
  }

  let best: SelectedScoringSeason | null = null;

  for (const seasonStat of eligible) {
    const score = scorePlayerSeason(seasonStat, scoringPosition, baselines);
    if (
      !best ||
      score.productionScore > best.score.productionScore ||
      (score.productionScore === best.score.productionScore &&
        (seasonStat.games ?? 0) > (best.seasonStat?.games ?? 0))
    ) {
      best = { season: seasonStat.season, seasonStat, score };
    }
  }

  return best ?? {
    season: null,
    seasonStat: null,
    score: scorePlayerSeason(emptySeasonStat(), scoringPosition, baselines),
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
    rushingTouchdowns: null,
    receptions: null,
    receivingYards: null,
    receivingTouchdowns: null,
  };
}
