export const SOUND_EVENTS = [
  "SPIN_TICK",
  "TEAM_REVEAL",
  "ERA_REVEAL",
  "DRAFT_LOCK",
  "SKIP",
  "SHOW_RESULTS",
  "JACKPOT",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

export const SOUND_FILES = {
  SPIN_TICK: "/sounds/spin-tick.mp3",
  TEAM_REVEAL: "/sounds/reveal-hit.mp3",
  ERA_REVEAL: "/sounds/reveal-hit.mp3",
  DRAFT_LOCK: "/sounds/draft-lock.mp3",
  SKIP: "/sounds/reveal-hit.mp3",
  SHOW_RESULTS: "/sounds/show-results.mp3",
  JACKPOT: "/sounds/jackpot.mp3",
} as const satisfies Record<SoundEvent, string>;

export const SOUND_DEFAULTS: Readonly<
  Record<SoundEvent, { volume: number; playbackRate: number; throttleMs: number }>
> = {
  SPIN_TICK: { volume: 0.55, playbackRate: 1, throttleMs: 2500 },
  TEAM_REVEAL: { volume: 0.78, playbackRate: 1, throttleMs: 0 },
  ERA_REVEAL: { volume: 0.78, playbackRate: 1.05, throttleMs: 0 },
  DRAFT_LOCK: { volume: 0.72, playbackRate: 1, throttleMs: 0 },
  SKIP: { volume: 0.62, playbackRate: 0.96, throttleMs: 0 },
  SHOW_RESULTS: { volume: 0.8, playbackRate: 1, throttleMs: 2500 },
  JACKPOT: { volume: 0.85, playbackRate: 1, throttleMs: 2500 },
};

export const SOUND_STORAGE_KEY = "sixteen-and-oh.soundEnabled";

export function soundFileForEvent(event: SoundEvent): string {
  return SOUND_FILES[event];
}
