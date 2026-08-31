/** @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { playDraftLockSound, playFinalRecordSound, playJackpotIfPerfect, playStadiumCrowdIfPerfect } from "@/lib/audio/cues";
import {
  SOUND_DEFAULTS,
  SOUND_EVENTS,
  SOUND_FILES,
  SOUND_MASTER_VOLUME,
  SOUND_STORAGE_KEY,
  cuePlaybackVolume,
  enginePlaybackVolume,
  soundFileForEvent,
} from "@/lib/audio/events";
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
  loop = true;
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
    expect(soundFileForEvent("STADIUM_CROWD")).toBe("/sounds/stadium-crowd.mp3");
    expect(SOUND_FILES.TEAM_REVEAL).toBe(SOUND_FILES.ERA_REVEAL);
    expect(SOUND_STORAGE_KEY).toBe("seventeen-and-oh.soundEnabled");
  });

  it("reduces only draft-lock playback volume by cue gain", () => {
    expect(SOUND_DEFAULTS.DRAFT_LOCK.gain).toBe(0.75);
    expect(cuePlaybackVolume("DRAFT_LOCK")).toBeCloseTo(0.72 * 0.75, 8);
    expect(cuePlaybackVolume("SPIN_TICK")).toBe(SOUND_DEFAULTS.SPIN_TICK.volume);
    expect(cuePlaybackVolume("TEAM_REVEAL")).toBe(SOUND_DEFAULTS.TEAM_REVEAL.volume);
    expect(cuePlaybackVolume("ERA_REVEAL")).toBe(SOUND_DEFAULTS.ERA_REVEAL.volume);
    expect(cuePlaybackVolume("SHOW_RESULTS")).toBe(SOUND_DEFAULTS.SHOW_RESULTS.volume);
    expect(cuePlaybackVolume("JACKPOT")).toBe(SOUND_DEFAULTS.JACKPOT.volume);
    expect(cuePlaybackVolume("STADIUM_CROWD")).toBe(0.75);
    expect(SOUND_DEFAULTS.STADIUM_CROWD.volume).toBe(0.75);
    expect(SOUND_DEFAULTS.STADIUM_CROWD.gain).toBe(1);
    expect(SOUND_DEFAULTS.SPIN_TICK.gain).toBe(1);
    expect(SOUND_DEFAULTS.TEAM_REVEAL.gain).toBe(1);
    expect(SOUND_DEFAULTS.ERA_REVEAL.gain).toBe(1);
    expect(SOUND_DEFAULTS.SHOW_RESULTS.gain).toBe(1);
    expect(SOUND_DEFAULTS.JACKPOT.gain).toBe(1);
  });

  it("keeps per-cue volumes unchanged and applies a 0.75 master multiplier at playback", () => {
    expect(SOUND_MASTER_VOLUME).toBe(0.75);
    expect(SOUND_DEFAULTS.STADIUM_CROWD.volume).toBe(0.75);
    expect(cuePlaybackVolume("STADIUM_CROWD")).toBe(0.75);
    expect(enginePlaybackVolume("STADIUM_CROWD")).toBeCloseTo(0.5625, 8);
    for (const event of SOUND_EVENTS) {
      expect(enginePlaybackVolume(event)).toBeCloseTo(cuePlaybackVolume(event) * SOUND_MASTER_VOLUME, 8);
    }
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

  it("applies the reduced draft-lock volume at playback", () => {
    const played: Array<{ src: string; volume: number }> = [];
    class TrackingAudio extends FakeAudio {
      play = () => {
        played.push({ src: this.src, volume: this.volume });
        this.paused = false;
        return play();
      };
    }
    vi.stubGlobal("Audio", TrackingAudio);
    unlockGameAudio();
    played.length = 0;
    play.mockClear();
    playGameSound("DRAFT_LOCK");
    expect(played.some((entry) => entry.src === "/sounds/draft-lock.mp3")).toBe(true);
    expect(
      played.filter((entry) => entry.src === "/sounds/draft-lock.mp3").every(
        (entry) => Math.abs(entry.volume - 0.72 * 0.75 * SOUND_MASTER_VOLUME) < 0.0001,
      ),
    ).toBe(true);

    played.length = 0;
    playGameSound("TEAM_REVEAL");
    expect(
      played
        .filter((entry) => entry.src === "/sounds/reveal-hit.mp3")
        .every((entry) => Math.abs(entry.volume - 0.78 * SOUND_MASTER_VOLUME) < 0.0001),
    ).toBe(true);
  });

  it("plays draft lock only through the committed draft cue", () => {
    unlockGameAudio();
    play.mockClear();
    playDraftLockSound();
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays jackpot only for a projected 17-0 season", () => {
    unlockGameAudio();
    play.mockClear();
    playJackpotIfPerfect(16);
    playJackpotIfPerfect(15);
    expect(play).not.toHaveBeenCalled();
    playJackpotIfPerfect(17);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it("plays stadium crowd only for a projected 17-0 season", () => {
    const played: string[] = [];
    class TrackingAudio extends FakeAudio {
      play = () => {
        played.push(this.src);
        this.paused = false;
        return play();
      };
    }
    vi.stubGlobal("Audio", TrackingAudio);
    unlockGameAudio();
    played.length = 0;
    play.mockClear();
    playStadiumCrowdIfPerfect(16);
    playStadiumCrowdIfPerfect(15);
    expect(play).not.toHaveBeenCalled();
    expect(played).toEqual([]);
    playStadiumCrowdIfPerfect(17);
    expect(play).toHaveBeenCalledTimes(1);
    expect(played).toEqual(["/sounds/stadium-crowd.mp3"]);
  });

  it("plays show-results once for a non-perfect result and jackpot once for 17-0", () => {
    const played: string[] = [];
    class TrackingAudio extends FakeAudio {
      play = () => {
        played.push(this.src);
        this.paused = false;
        return play();
      };
    }
    vi.stubGlobal("Audio", TrackingAudio);
    unlockGameAudio();
    played.length = 0;
    play.mockClear();

    playFinalRecordSound(16);
    expect(play).toHaveBeenCalledTimes(1);
    expect(played).toEqual(["/sounds/show-results.mp3"]);

    resetSoundEngineForTests();
    unlockGameAudio();
    played.length = 0;
    play.mockClear();
    playFinalRecordSound(12);
    expect(play).toHaveBeenCalledTimes(1);
    expect(played).toEqual(["/sounds/show-results.mp3"]);

    resetSoundEngineForTests();
    unlockGameAudio();
    played.length = 0;
    play.mockClear();
    playFinalRecordSound(17);
    expect(play).toHaveBeenCalledTimes(2);
    expect(played).toEqual(["/sounds/jackpot.mp3", "/sounds/stadium-crowd.mp3"]);
    expect(played).not.toContain("/sounds/show-results.mp3");
  });

  it("plays stadium crowd at configured 0.75, effective 0.5625, once and without looping", () => {
    const played: Array<{ src: string; volume: number; loop: boolean }> = [];
    class TrackingAudio extends FakeAudio {
      play = () => {
        played.push({ src: this.src, volume: this.volume, loop: this.loop });
        this.paused = false;
        return play();
      };
    }
    vi.stubGlobal("Audio", TrackingAudio);
    unlockGameAudio();
    played.length = 0;
    play.mockClear();
    playFinalRecordSound(17);
    const crowd = played.filter((entry) => entry.src === "/sounds/stadium-crowd.mp3");
    expect(crowd).toHaveLength(1);
    expect(SOUND_DEFAULTS.STADIUM_CROWD.volume).toBe(0.75);
    expect(crowd[0]?.volume).toBeCloseTo(0.5625, 8);
    expect(crowd[0]?.loop).toBe(false);
  });

  it("applies the master volume to every sound event at playback", () => {
    const played: Array<{ src: string; volume: number }> = [];
    class TrackingAudio extends FakeAudio {
      play = () => {
        played.push({ src: this.src, volume: this.volume });
        this.paused = false;
        return play();
      };
    }
    vi.stubGlobal("Audio", TrackingAudio);

    for (const event of SOUND_EVENTS) {
      resetSoundEngineForTests();
      unlockGameAudio();
      played.length = 0;
      play.mockClear();
      playGameSound(event);
      const src = soundFileForEvent(event);
      const matching = played.filter((entry) => entry.src === src);
      expect(matching.length).toBeGreaterThan(0);
      expect(
        matching.every(
          (entry) => Math.abs(entry.volume - enginePlaybackVolume(event)) < 0.0001,
        ),
      ).toBe(true);
    }
  });

  it("does not play stadium crowd when sound is off", () => {
    setSoundEnabled(false);
    unlockGameAudio();
    play.mockClear();
    playFinalRecordSound(17);
    expect(play).not.toHaveBeenCalled();
  });
});
