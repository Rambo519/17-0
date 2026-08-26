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

/** Played once when a non-16–0 projected record first lands. */
export function playShowResultsSound(): void {
  playGameSound("SHOW_RESULTS");
}

/** Played only for a server-projected 16–0 season, after 16–0 lands. */
export function playJackpotIfPerfect(projectedWins: number): void {
  if (!isPerfectProjectedSeason(projectedWins)) return;
  playGameSound("JACKPOT");
}

/** Exactly one landing cue: jackpot for 16–0, otherwise show-results. Never both. */
export function playFinalRecordSound(projectedWins: number): void {
  if (isPerfectProjectedSeason(projectedWins)) {
    playGameSound("JACKPOT");
    return;
  }
  playGameSound("SHOW_RESULTS");
}
