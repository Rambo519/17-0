"use client";

import { useCallback, useSyncExternalStore } from "react";

import {
  isSoundEnabled,
  playGameSound,
  setSoundEnabled,
  subscribeSoundPreference,
  unlockGameAudio,
} from "./soundEngine";
import type { SoundEvent } from "./events";

export function useGameAudio() {
  const enabled = useSyncExternalStore(subscribeSoundPreference, isSoundEnabled, () => true);

  const setEnabled = useCallback((next: boolean) => {
    setSoundEnabled(next);
    if (next) unlockGameAudio();
  }, []);

  const play = useCallback((event: SoundEvent) => {
    unlockGameAudio();
    playGameSound(event);
  }, []);

  const unlock = useCallback(() => {
    unlockGameAudio();
  }, []);

  return { enabled, setEnabled, play, unlock };
}
