import { REGULAR_SEASON_GAMES, projectedLossesFromWins } from "@/lib/football/season";

export const RECORD_REVEAL = {
  durationMs: 1550,
  landedHoldMs: 850,
  perfectPauseMs: 360,
  perfectSettleMs: 20,
} as const;

export interface RecordRevealFrame {
  wins: number;
  losses: number;
  landed: boolean;
  counting: boolean;
  jackpot: boolean;
}

function clampWins(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(REGULAR_SEASON_GAMES, Math.round(value)));
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function recordRevealEndsAt(_targetWins: number): number {
  return RECORD_REVEAL.durationMs + RECORD_REVEAL.landedHoldMs;
}

/** Presentation-only count from 0 toward a server-projected win total. */
export function recordRevealAt(elapsedMs: number, targetWins: number): RecordRevealFrame {
  const target = clampWins(targetWins);
  const lossesFor = (wins: number) => projectedLossesFromWins(wins);
  const perfect = target === REGULAR_SEASON_GAMES;
  const penultimateWins = REGULAR_SEASON_GAMES - 1;

  if (elapsedMs <= 0) {
    return {
      wins: 0,
      losses: REGULAR_SEASON_GAMES,
      landed: false,
      counting: true,
      jackpot: false,
    };
  }

  if (!perfect) {
    const t = Math.min(1, elapsedMs / RECORD_REVEAL.durationMs);
    const wins = t >= 1 ? target : Math.min(target, Math.round(easeOutCubic(t) * target));
    const landed = t >= 1;
    return {
      wins,
      losses: lossesFor(wins),
      landed,
      counting: !landed,
      jackpot: false,
    };
  }

  const climbMs =
    RECORD_REVEAL.durationMs - RECORD_REVEAL.perfectPauseMs - RECORD_REVEAL.perfectSettleMs;
  const holdEnd = climbMs + RECORD_REVEAL.perfectPauseMs;

  if (elapsedMs < climbMs) {
    const t = elapsedMs / climbMs;
    const wins = Math.min(penultimateWins, Math.round(easeOutCubic(t) * penultimateWins));
    return { wins, losses: lossesFor(wins), landed: false, counting: true, jackpot: false };
  }

  if (elapsedMs < holdEnd) {
    return {
      wins: penultimateWins,
      losses: lossesFor(penultimateWins),
      landed: false,
      counting: true,
      jackpot: false,
    };
  }

  return {
    wins: REGULAR_SEASON_GAMES,
    losses: 0,
    landed: true,
    counting: false,
    jackpot: true,
  };
}
