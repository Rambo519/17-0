/** Authoritative NFL regular-season length for projected-record math. */
export const REGULAR_SEASON_GAMES = 17;

export const PERFECT_SEASON_WINS = REGULAR_SEASON_GAMES;

export const PERFECT_SEASON_LOSSES = 0;

export function projectedLossesFromWins(wins: number): number {
  return REGULAR_SEASON_GAMES - wins;
}

export function isPerfectSeasonWins(wins: number): boolean {
  return Math.round(wins) === PERFECT_SEASON_WINS;
}
