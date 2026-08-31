export const SOUND_EVENTS = [
  "SPIN_TICK",
  "TEAM_REVEAL",
  "ERA_REVEAL",
  "DRAFT_LOCK",
  "SKIP",
  "SHOW_RESULTS",
  "JACKPOT",
  "STADIUM_CROWD",
] as const;

export type SoundEvent = (typeof SOUND_EVENTS)[number];

/** Canonical source: https://github.com/Rambo519/17-0 — runtime files live in public/sounds/. */
export const SOUND_FILES = {
  SPIN_TICK: "/sounds/spin-tick.mp3",
  TEAM_REVEAL: "/sounds/reveal-hit.mp3",
  ERA_REVEAL: "/sounds/reveal-hit.mp3",
  DRAFT_LOCK: "/sounds/draft-lock.mp3",
  SKIP: "/sounds/reveal-hit.mp3",
  SHOW_RESULTS: "/sounds/show-results.mp3",
  JACKPOT: "/sounds/jackpot.mp3",
  STADIUM_CROWD: "/sounds/stadium-crowd.mp3",
} as const satisfies Record<SoundEvent, string>;

export interface SoundCueDefaults {
  volume: number;
  /** Cue-level gain multiplier applied to `volume` at playback. */
  gain: number;
  playbackRate: number;
  throttleMs: number;
}

export const SOUND_DEFAULTS: Readonly<Record<SoundEvent, SoundCueDefaults>> = {
  SPIN_TICK: { volume: 0.55, gain: 1, playbackRate: 1, throttleMs: 2500 },
  TEAM_REVEAL: { volume: 0.78, gain: 1, playbackRate: 1, throttleMs: 0 },
  ERA_REVEAL: { volume: 0.78, gain: 1, playbackRate: 1.05, throttleMs: 0 },
  DRAFT_LOCK: { volume: 0.72, gain: 0.75, playbackRate: 1, throttleMs: 0 },
  SKIP: { volume: 0.62, gain: 1, playbackRate: 0.96, throttleMs: 0 },
  SHOW_RESULTS: { volume: 0.8, gain: 1, playbackRate: 1, throttleMs: 2500 },
  JACKPOT: { volume: 0.85, gain: 1, playbackRate: 1, throttleMs: 2500 },
  STADIUM_CROWD: { volume: 0.75, gain: 1, playbackRate: 1, throttleMs: 2500 },
};

/** Applied to every cue at playback. Per-cue volume and gain stay unchanged. */
export const SOUND_MASTER_VOLUME = 0.75;

export function cuePlaybackVolume(event: SoundEvent): number {
  const defaults = SOUND_DEFAULTS[event];
  return Math.min(1, Math.max(0, defaults.volume * defaults.gain));
}

export function enginePlaybackVolume(event: SoundEvent): number {
  return Math.min(1, Math.max(0, cuePlaybackVolume(event) * SOUND_MASTER_VOLUME));
}

export const SOUND_STORAGE_KEY = "seventeen-and-oh.soundEnabled";

export function soundFileForEvent(event: SoundEvent): string {
  return SOUND_FILES[event];
}
