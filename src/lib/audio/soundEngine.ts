import {
  SOUND_DEFAULTS,
  SOUND_FILES,
  SOUND_STORAGE_KEY,
  type SoundEvent,
  enginePlaybackVolume,
  soundFileForEvent,
} from "./events";

type Listener = () => void;

const listeners = new Set<Listener>();
const missingSources = new Set<string>();
const nodes = new Map<string, HTMLAudioElement>();
const lastPlayedAt = new Map<SoundEvent, number>();

const UNIQUE_SOURCES = [...new Set(Object.values(SOUND_FILES))];

let enabled = true;
let unlocked = false;
let primed = false;
let storageRead = false;

function canUseDom(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

function readStoredPreference(): boolean {
  if (storageRead) return enabled;
  storageRead = true;
  if (!canUseDom()) return enabled;
  try {
    const stored = window.localStorage.getItem(SOUND_STORAGE_KEY);
    if (stored === "off") enabled = false;
    if (stored === "on") enabled = true;
  } catch {
    // Ignore private-mode / storage failures.
  }
  return enabled;
}

function persistPreference(next: boolean): void {
  if (!canUseDom()) return;
  try {
    window.localStorage.setItem(SOUND_STORAGE_KEY, next ? "on" : "off");
  } catch {
    // Ignore storage failures.
  }
}

function notify(): void {
  for (const listener of listeners) listener();
}

function getNode(src: string): HTMLAudioElement | null {
  if (!canUseDom() || missingSources.has(src)) return null;

  let node = nodes.get(src);
  if (!node) {
    try {
      node = new Audio(src);
      node.preload = "auto";
      node.addEventListener(
        "error",
        () => {
          missingSources.add(src);
          nodes.delete(src);
        },
        { once: true },
      );
      nodes.set(src, node);
    } catch {
      missingSources.add(src);
      return null;
    }
  }
  return node;
}

function primeSource(src: string): void {
  if (missingSources.has(src)) return;
  getNode(src);
  if (src === SOUND_FILES.SPIN_TICK) return;
  try {
    const primer = new Audio(src);
    primer.preload = "auto";
    primer.muted = true;
    primer.volume = 0;
    primer.addEventListener(
      "error",
      () => {
        missingSources.add(src);
      },
      { once: true },
    );
    const result = primer.play();
    if (result && typeof result.then === "function") {
      void result
        .then(() => {
          try {
            primer.pause();
            primer.currentTime = 0;
          } catch {
            // Primer cleanup is best-effort.
          }
        })
        .catch(() => {
          // Gesture priming failed. Later play() calls still try.
        });
    }
  } catch {
    // Ignore constructor failures; gameplay nodes handle missing files.
  }
}

export function isSoundEnabled(): boolean {
  return readStoredPreference();
}

export function setSoundEnabled(next: boolean): void {
  readStoredPreference();
  enabled = next;
  persistPreference(next);
  if (next && unlocked) {
    primed = false;
    unlockGameAudio();
  }
  notify();
}

export function subscribeSoundPreference(listener: Listener): () => void {
  readStoredPreference();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Must be called from a user gesture. Primes HTMLAudioElements so later
 * play() calls during animation (after awaits) are allowed.
 */
export function unlockGameAudio(): void {
  if (!canUseDom()) return;
  unlocked = true;
  readStoredPreference();
  if (!enabled || primed) return;
  primed = true;
  for (const src of UNIQUE_SOURCES) {
    primeSource(src);
  }
}

export function isGameAudioUnlocked(): boolean {
  return unlocked;
}

export function isAudioSourceMissing(src: string): boolean {
  return missingSources.has(src);
}

export function markAudioSourceMissing(src: string): void {
  missingSources.add(src);
  nodes.delete(src);
}

function startPlayback(node: HTMLAudioElement, event: SoundEvent): void {
  const defaults = SOUND_DEFAULTS[event];
  node.loop = false;
  node.volume = enginePlaybackVolume(event);
  node.playbackRate = defaults.playbackRate;
  try {
    if (!node.paused) {
      node.currentTime = 0;
      return;
    }
    node.currentTime = 0;
    const playResult = node.play();
    if (playResult && typeof playResult.catch === "function") {
      void playResult.catch(() => {
        // Autoplay policy, missing files, or decode errors must never break play.
      });
    }
  } catch {
    // Playback failed. Gameplay continues.
  }
}

export function playGameSound(event: SoundEvent): void {
  if (!canUseDom()) return;
  readStoredPreference();
  if (!enabled || !unlocked) return;

  const defaults = SOUND_DEFAULTS[event];
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  const last = lastPlayedAt.get(event);
  if (last != null && defaults.throttleMs > 0 && now - last < defaults.throttleMs) return;

  const src = soundFileForEvent(event);
  if (missingSources.has(src)) return;

  const node = getNode(src);
  if (!node || missingSources.has(src)) return;

  lastPlayedAt.set(event, now);

  if (event === "SPIN_TICK") {
    startPlayback(node, event);
    return;
  }

  try {
    const shot = new Audio(src);
    startPlayback(shot, event);
  } catch {
    startPlayback(node, event);
  }
}

export function resetSoundEngineForTests(): void {
  enabled = true;
  unlocked = false;
  primed = false;
  storageRead = false;
  missingSources.clear();
  nodes.clear();
  lastPlayedAt.clear();
  listeners.clear();
}
