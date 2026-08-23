import type { MetricKey, SeasonStatRecord } from "./types";

export function metricValueFromSeason(stat: SeasonStatRecord, key: MetricKey): number | null {
  switch (key) {
    case "passing_yards":
      return stat.passingYards;
    case "passing_touchdowns":
      return stat.passingTouchdowns;
    case "interceptions":
      return stat.interceptions;
    case "rushing_yards":
      return stat.rushingYards;
    case "rushing_touchdowns":
      return stat.rushingTouchdowns;
    case "receptions":
      return stat.receptions;
    case "receiving_yards":
      return stat.receivingYards;
    case "receiving_touchdowns":
      return stat.receivingTouchdowns;
    default:
      return null;
  }
}

export function seasonHasKnownProduction(stat: SeasonStatRecord): boolean {
  return (
    stat.passingYards != null ||
    stat.passingTouchdowns != null ||
    stat.interceptions != null ||
    stat.rushingYards != null ||
    stat.rushingTouchdowns != null ||
    stat.receptions != null ||
    stat.receivingYards != null ||
    stat.receivingTouchdowns != null
  );
}

/** Seasons eligible for peak-season selection within a card window. */
export function isLegitimateScoringSeason(stat: SeasonStatRecord): boolean {
  if (stat.games != null && stat.games >= 4) return true;
  return seasonHasKnownProduction(stat);
}
