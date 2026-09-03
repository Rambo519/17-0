import { isPerfectProjectedSeason, resultTierFromProjectedWins } from "@/lib/results/tiers";

import { playGameSound } from "./soundEngine";

/** One spin-tick at the start of a successful SPIN click. Never during cycling. */
export function playSpinStartSound(): void {
  playGameSound("SPIN_TICK");
}

/** Played only after the server confirms a player was drafted into a slot. */
export function playDraftLockSound(): void {
  playGameSound("DRAFT_LOCK");
}

/** Played once when a non-perfect, non-fail record first lands. */
export function playShowResultsSound(): void {
  playGameSound("SHOW_RESULTS");
}

/** Played once when a ROUGH SEASON (6 wins or fewer) first lands. */
export function playFailTierSound(): void {
  playGameSound("FAIL_TIER");
}

/** Played only for a server-projected perfect season, after that record lands. */
export function playJackpotIfPerfect(projectedWins: number): void {
  if (!isPerfectProjectedSeason(projectedWins)) return;
  playGameSound("JACKPOT");
}

/** Crowd bed for a landed 17-0. Respects SOUND ON/OFF via the sound engine. */
export function playStadiumCrowdIfPerfect(projectedWins: number): void {
  if (!isPerfectProjectedSeason(projectedWins)) return;
  playGameSound("STADIUM_CROWD");
}

/** Landing cue: jackpot + crowd for 17-0, fail-tier for ROUGH SEASON, otherwise show-results. Never mixes jackpot with fail or show-results. */
export function playFinalRecordSound(projectedWins: number): void {
  if (isPerfectProjectedSeason(projectedWins)) {
    playGameSound("JACKPOT");
    playStadiumCrowdIfPerfect(projectedWins);
    return;
  }
  if (resultTierFromProjectedWins(projectedWins).id === "rough") {
    playFailTierSound();
    return;
  }
  playGameSound("SHOW_RESULTS");
}
