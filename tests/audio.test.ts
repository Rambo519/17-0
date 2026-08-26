/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playDraftLockSound, playFinalRecordSound, playJackpotIfPerfect } from "@/lib/audio/cues";
import { SOUND_FILES, SOUND_STORAGE_KEY, soundFileForEvent } from "@/lib/audio/events";
import {
  isSoundEnabled,
  markAudioSourceMissing,
  playGameSound,
  resetSoundEngineForTests,
  setSoundEnabled,
  unlockGameAudio,
} from "@/lib/audio/soundEngine";

const play = vi.fn(async () => undefined);

class FakeAudio {
  src: string;
  volume = 1;
  playbackRate = 1;
  currentTime = 0;
  preload = "";
  muted = false;
  paused = true;
  play = () => {
    this.paused = false;
    return play();
  };
  pause = vi.fn(() => {
    this.paused = true;
  });
  addEventListener = vi.fn();
  cloneNode() {
    return new FakeAudio(this.src);
  }

  constructor(src: string) {
    this.src = src;
  }
}

describe("audio event mapping", () => {
  it("maps game events to the expected public sound files", () => {
    expect(soundFileForEvent("SPIN_TICK")).toBe("/sounds/spin-tick.mp3");
    expect(soundFileForEvent("TEAM_REVEAL")).toBe("/sounds/reveal-hit.mp3");
    expect(soundFileForEvent("ERA_REVEAL")).toBe("/sounds/reveal-hit.mp3");
    expect(soundFileForEvent("DRAFT_LOCK")).toBe("/sounds/draft-lock.mp3");
    expect(soundFileForEvent("SKIP")).toBe("/sounds/reveal-hit.mp3");
    expect(soundFileForEvent("SHOW_RESULTS")).toBe("/sounds/show-results.mp3");
    expect(soundFileForEvent("JACKPOT")).toBe("/sounds/jackpot.mp3");
    expect(SOUND_FILES.TEAM_REVEAL).toBe(SOUND_FILES.ERA_REVEAL);
  });
});

describe("sound engine", () => {
  beforeEach(() => {
    play.mockClear();
    play.mockResolvedValue(undefined);
    resetSoundEngineForTests();
    window.localStorage.clear();
    vi.stubGlobal("Audio", FakeAudio);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    resetSoundEngineForTests();
    window.localStorage.clear();
  });

  it("does not play before a user gesture unlocks audio", () => {
    playGameSound("TEAM_REVEAL");
    expect(play).not.toHaveBeenCalled();
  });

  it("respects the sound-off preference and persists it", () => {
    setSoundEnabled(false);
    unlockGameAudio();
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    playGameSound("TEAM_REVEAL");
    expect(play).not.toHaveBeenCalled();

    resetSoundEngineForTests();
    expect(isSoundEnabled()).toBe(false);
    unlockGameAudio();
    playGameSound("TEAM_REVEAL");
    expect(play).not.toHaveBeenCalled();
  });

  it("plays mapped files after unlock when sound is on", () => {
    unlockGameAudio();
    play.mockClear();
    playGameSound("TEAM_REVEAL");
    playGameSound("ERA_REVEAL");
    playGameSound("DRAFT_LOCK");
    expect(play).toHaveBeenCalledTimes(3);
  });

  it("plays a single spin-tick even if the start cue is invoked twice", () => {
    unlockGameAudio();
    play.mockClear();
    playGameSound("SPIN_TICK");
    playGameSound("SPIN_TICK");
    playGameSound("SPIN_TICK");
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("swallows missing audio files without throwing", () => {
    unlockGameAudio();
    play.mockClear();
    markAudioSourceMissing("/sounds/spin-tick.mp3");
    expect(() => playGameSound("SPIN_TICK")).not.toThrow();
    expect(play).not.toHaveBeenCalled();
    expect(() => playGameSound("TEAM_REVEAL")).not.toThrow();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("does not break gameplay when Audio construction fails", () => {
    vi.stubGlobal(
      "Audio",
      class {
        constructor() {
          throw new Error("audio unavailable");
        }
      },
    );
    unlockGameAudio();
    expect(() => playGameSound("JACKPOT")).not.toThrow();
  });

  it("does not break gameplay when playback rejects", async () => {
    play.mockRejectedValue(new Error("NotAllowedError"));
    unlockGameAudio();
    expect(() => playGameSound("TEAM_REVEAL")).not.toThrow();
    await Promise.resolve();
    expect(() => playGameSound("ERA_REVEAL")).not.toThrow();
  });

  it("plays draft lock only through the committed draft cue", () => {
    unlockGameAudio();
    play.mockClear();
    playDraftLockSound();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays jackpot only for a projected 16-0 season", () => {
    unlockGameAudio();
    play.mockClear();
    playJackpotIfPerfect(15);
    playJackpotIfPerfect(14);
    expect(play).not.toHaveBeenCalled();
    playJackpotIfPerfect(16);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays exactly one landing cue and never both jackpot and show-results", () => {
    unlockGameAudio();
    play.mockClear();
    playFinalRecordSound(12);
    expect(play).toHaveBeenCalledTimes(1);
    play.mockClear();
    playFinalRecordSound(16);
    expect(play).toHaveBeenCalledTimes(1);
  });
});
