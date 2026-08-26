import { isPerfectProjectedSeason } from "@/lib/results/tiers";

import { playGameSound } from "./soundEngine";

/** One spin-tick at the start of a successful SPIN click. Never during cycling. */
export function playSpinStartSound(): void {
  playGameSound("SPIN_TICK");
}

/** Played only after the server confirms a player was drafted into a slot. */
export function playDraftLockSound(): void {
  playGameSound("DRAFT_LOCK");
}

/** Played once when a non-perfect projected record first lands. */
export function playShowResultsSound(): void {
  playGameSound("SHOW_RESULTS");
}

/** Played only for a server-projected perfect season, after that record lands. */
export function playJackpotIfPerfect(projectedWins: number): void {
  if (!isPerfectProjectedSeason(projectedWins)) return;
  playGameSound("JACKPOT");
}

/** Exactly one landing cue: jackpot for a perfect season, otherwise show-results. Never both. */
export function playFinalRecordSound(projectedWins: number): void {
  if (isPerfectProjectedSeason(projectedWins)) {
    playGameSound("JACKPOT");
    return;
  }
  playGameSound("SHOW_RESULTS");
}
