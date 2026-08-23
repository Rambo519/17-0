import { describe, expect, it } from "vitest";

import {
  ERA_DEFINITIONS,
  PLAYABLE_ERA_DEFINITIONS,
  PLAYABLE_ERA_LABELS,
  PLAYABLE_ERA_START_SEASON,
  eraDefinitionForSeason,
  isPlayableEraLabel,
  isPlayableSeason,
} from "@/lib/football/eras";
import type { DraftableCard } from "@/lib/game/types";

describe("playable eras (1970s–2020s)", () => {
  it("defines exactly six supported decades", () => {
    expect(PLAYABLE_ERA_DEFINITIONS).toHaveLength(6);
    expect(PLAYABLE_ERA_LABELS).toEqual([
      "1970s",
      "1980s",
      "1990s",
      "2000s",
      "2010s",
      "2020s",
    ]);
    expect(ERA_DEFINITIONS).toEqual(PLAYABLE_ERA_DEFINITIONS);
    expect(PLAYABLE_ERA_START_SEASON).toBe(1970);
  });

  it("does not map pre-1970 seasons to a playable era", () => {
    expect(eraDefinitionForSeason(1969)).toBeNull();
    expect(isPlayableSeason(1965)).toBe(false);
    expect(isPlayableEraLabel("1960s")).toBe(false);
    expect(eraDefinitionForSeason(1970)?.label).toBe("1970s");
  });

  it("excludes 1960s cards from the playable draft pool filter", () => {
    const cards: DraftableCard[] = [
      {
        cardId: 1,
        playerId: 1,
        playerName: "Jim Brown",
        franchiseId: 1,
        franchiseName: "Cleveland Browns",
        franchiseAbbreviation: "CLE",
        eraId: 1,
        eraLabel: "1960s",
        firstSeason: 1960,
        lastSeason: 1965,
        representativeSeason: 1963,
        draftable: true,
        positions: ["RB"],
        production: {
          games: null,
          passingYards: null,
          passingTouchdowns: null,
          rushingYards: 8000,
          rushingTouchdowns: null,
          receptions: null,
          receivingYards: null,
          receivingTouchdowns: null,
        },
      },
      {
        cardId: 2,
        playerId: 2,
        playerName: "Terry Bradshaw",
        franchiseId: 2,
        franchiseName: "Pittsburgh Steelers",
        franchiseAbbreviation: "PIT",
        eraId: 2,
        eraLabel: "1970s",
        firstSeason: 1970,
        lastSeason: 1979,
        representativeSeason: 1978,
        draftable: true,
        positions: ["QB"],
        production: {
          games: null,
          passingYards: 19000,
          passingTouchdowns: null,
          rushingYards: null,
          rushingTouchdowns: null,
          receptions: null,
          receivingYards: null,
          receivingTouchdowns: null,
        },
      },
    ];

    const playablePool = cards.filter((card) => isPlayableEraLabel(card.eraLabel));
    expect(playablePool).toHaveLength(1);
    expect(playablePool[0]?.eraLabel).toBe("1970s");
  });
});
