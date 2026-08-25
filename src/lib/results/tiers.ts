/**
 * Presentation-only result tiers from the projected 16-game win total.
 * Does not affect scoring, expected wins, or probability math.
 */

export type ResultTierId =
  | "rough"
  | "competitive"
  | "contender"
  | "powerhouse"
  | "allTime"
  | "perfect";

export interface ResultTier {
  id: ResultTierId;
  label: string;
}

export function resultTierFromProjectedWins(projectedWins: number): ResultTier {
  const wins = Math.round(projectedWins);

  if (wins >= 16) {
    return { id: "perfect", label: "16 & 0" };
  }
  if (wins >= 14) {
    return { id: "allTime", label: "ALL-TIME OFFENSE" };
  }
  if (wins >= 12) {
    return { id: "powerhouse", label: "POWERHOUSE" };
  }
  if (wins >= 10) {
    return { id: "contender", label: "PLAYOFF CONTENDER" };
  }
  if (wins >= 7) {
    return { id: "competitive", label: "COMPETITIVE" };
  }
  return { id: "rough", label: "ROUGH SEASON" };
}

export function isPerfectProjectedSeason(projectedWins: number): boolean {
  return Math.round(projectedWins) === 16;
}
