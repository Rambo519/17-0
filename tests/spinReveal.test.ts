import { describe, expect, it } from "vitest";

import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { SpinResult } from "@/lib/game/spin";
import { runSpinReveal, SPIN_REVEAL_TIMING, type SpinRevealFrame } from "@/lib/game/spinReveal";

function spinResult(): SpinResult {
  return {
    sessionId: "session-1",
    franchise: { id: 1, name: "San Francisco 49ers", abbreviation: "SF" },
    era: { id: 1, label: "1980s" },
    openSlots: ["QB"],
    candidates: [
      {
        eligibleSlots: ["QB"],
        card: {
          cardId: 1,
          playerId: 1,
          playerName: "Joe Montana",
          franchiseId: 1,
          franchiseName: "San Francisco 49ers",
          franchiseAbbreviation: "SF",
          eraId: 1,
          eraLabel: "1980s",
          positions: ["QB"],
          firstSeason: 1981,
          lastSeason: 1989,
          representativeSeason: 1989,
          draftable: true,
          production: EMPTY_PRODUCTION,
        },
      },
    ],
  };
}

function createClock() {
  let nowMs = 0;
  return {
    now: () => nowMs,
    wait: async (ms: number) => {
      nowMs += ms;
    },
    elapsed: () => nowMs,
  };
}

describe("runSpinReveal", () => {
  it("cycles visually then settles on the actual backend result", async () => {
    const clock = createClock();
    const frames: SpinRevealFrame[] = [];
    const result = spinResult();
    const ticks: number[] = [];
    let teamLockAt = -1;
    let eraLockAt = -1;

    const resolved = await runSpinReveal(
      "full",
      Promise.resolve(result),
      {
        wait: clock.wait,
        now: clock.now,
        rng: () => 0,
        onFrame: (frame) => frames.push({ ...frame }),
        onTick: () => ticks.push(clock.elapsed()),
        onTeamLock: () => {
          teamLockAt = clock.elapsed();
        },
        onEraLock: () => {
          eraLockAt = clock.elapsed();
        },
      },
      { reducedMotion: false },
    );

    expect(resolved).toEqual(result);
    expect(clock.elapsed()).toBeGreaterThanOrEqual(1250);
    expect(clock.elapsed()).toBeLessThanOrEqual(1740);
    expect(teamLockAt).toBeGreaterThanOrEqual(1100);
    expect(teamLockAt).toBeLessThanOrEqual(1280);
    expect(eraLockAt).toBeGreaterThan(teamLockAt);
    expect(eraLockAt).toBeGreaterThanOrEqual(1380);
    expect(eraLockAt).toBeLessThanOrEqual(1600);
    expect(ticks.length).toBeGreaterThan(3);

    const cycling = frames.filter((frame) => frame.cycling);
    expect(cycling.length).toBeGreaterThan(0);
    expect(cycling.some((frame) => !frame.teamLocked && frame.abbreviation !== "SF")).toBe(true);

    const teamThenEra = frames.filter((frame) => frame.teamLocked && !frame.eraLocked);
    expect(teamThenEra.length).toBeGreaterThan(1);
    expect(teamThenEra.every((frame) => frame.abbreviation === "SF")).toBe(true);
    expect(new Set(teamThenEra.map((frame) => frame.eraLabel)).size).toBeGreaterThan(1);
    expect(teamThenEra[0]?.showCandidates).toBe(false);

    const last = frames.at(-1);
    expect(last).toMatchObject({
      abbreviation: "SF",
      franchiseName: "San Francisco 49ers",
      eraLabel: "1980s",
      teamLocked: true,
      eraLocked: true,
      showCandidates: true,
      cycling: false,
    });
    expect(frames.every((frame) => frame.showCandidates === false || frame === last)).toBe(true);
  });

  it("skips rapid cycling when reduced motion is preferred", async () => {
    const clock = createClock();
    const frames: SpinRevealFrame[] = [];
    const result = spinResult();

    await runSpinReveal(
      "full",
      Promise.resolve(result),
      {
        wait: clock.wait,
        now: clock.now,
        rng: () => 0,
        onFrame: (frame) => frames.push({ ...frame }),
        onTick: () => {
          throw new Error("ticks should not fire for reduced motion");
        },
      },
      { reducedMotion: true },
    );

    expect(clock.elapsed()).toBe(SPIN_REVEAL_TIMING.reducedMotionMs);
    expect(frames.some((frame) => frame.cycling)).toBe(false);
    expect(frames.at(-1)).toMatchObject({
      abbreviation: "SF",
      eraLabel: "1980s",
      showCandidates: true,
      teamLocked: true,
      eraLocked: true,
    });
  });

  it("keeps cycling until a slow backend result arrives", async () => {
    const clock = createClock();
    const frames: SpinRevealFrame[] = [];
    let resolveResult!: (value: SpinResult) => void;
    let released = false;
    const pending = new Promise<SpinResult>((resolve) => {
      resolveResult = resolve;
    });

    const done = runSpinReveal(
      "full",
      pending,
      {
        wait: async (ms) => {
          await clock.wait(ms);
          if (!released && clock.elapsed() >= 800) {
            released = true;
            resolveResult(spinResult());
            await Promise.resolve();
          }
        },
        now: clock.now,
        rng: () => 0,
        onFrame: (frame) => frames.push({ ...frame }),
      },
      { reducedMotion: false },
    );

    const resolved = await done;
    expect(resolved.franchise.abbreviation).toBe("SF");
    expect(clock.elapsed()).toBeGreaterThan(800);
    expect(frames.filter((frame) => frame.cycling).length).toBeGreaterThan(10);
    expect(frames.at(-1)?.showCandidates).toBe(true);
  });
});
