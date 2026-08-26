import { describe, expect, it } from "vitest";

import { REGULAR_SEASON_GAMES } from "@/lib/football/season";
import { RECORD_REVEAL, recordRevealAt } from "@/lib/results/recordReveal";

describe("recordRevealAt", () => {
  it("counts from 0 toward the server result and lands exactly", () => {
    expect(recordRevealAt(0, 12)).toMatchObject({
      wins: 0,
      losses: REGULAR_SEASON_GAMES,
      landed: false,
      jackpot: false,
    });
    const mid = recordRevealAt(RECORD_REVEAL.durationMs / 2, 12);
    expect(mid.wins).toBeGreaterThan(0);
    expect(mid.wins).toBeLessThan(12);
    expect(mid.losses).toBe(REGULAR_SEASON_GAMES - mid.wins);
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 12)).toEqual({
      wins: 12,
      losses: 5,
      landed: true,
      counting: false,
      jackpot: false,
    });
    expect(recordRevealAt(RECORD_REVEAL.durationMs + RECORD_REVEAL.landedHoldMs, 12)).toMatchObject({
      wins: 12,
      losses: 5,
      landed: true,
    });
  });

  it("never plays jackpot for 16-1 or other non-perfect records", () => {
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 8).jackpot).toBe(false);
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 16)).toEqual({
      wins: 16,
      losses: 1,
      landed: true,
      counting: false,
      jackpot: false,
    });
    expect(recordRevealAt(RECORD_REVEAL.durationMs, 15)).toEqual({
      wins: 15,
      losses: 2,
      landed: true,
      counting: false,
      jackpot: false,
    });
  });

  it("holds 16-1 then lands 17-0 before jackpot", () => {
    const climbMs =
      RECORD_REVEAL.durationMs - RECORD_REVEAL.perfectPauseMs - RECORD_REVEAL.perfectSettleMs;
    const duringHold = recordRevealAt(climbMs + 10, REGULAR_SEASON_GAMES);
    expect(duringHold).toMatchObject({ wins: 16, losses: 1, landed: false, jackpot: false });
    const justLanded = recordRevealAt(climbMs + RECORD_REVEAL.perfectPauseMs, REGULAR_SEASON_GAMES);
    expect(justLanded).toEqual({
      wins: 17,
      losses: 0,
      landed: true,
      counting: false,
      jackpot: true,
    });
    const afterHold = recordRevealAt(
      RECORD_REVEAL.durationMs + RECORD_REVEAL.landedHoldMs,
      REGULAR_SEASON_GAMES,
    );
    expect(afterHold).toMatchObject({ wins: 17, losses: 0, landed: true, jackpot: true });
  });
});
