/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "@/components/game/GameApp";
import { SOUND_STORAGE_KEY } from "@/lib/audio/events";
import { resetSoundEngineForTests } from "@/lib/audio/soundEngine";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { SpinResult } from "@/lib/game/spin";
import type { GameStateView } from "@/lib/game/view";

vi.mock("@/lib/game/spinReveal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/game/spinReveal")>();
  return {
    ...actual,
    prefersReducedMotion: () => true,
    wait: async () => undefined,
  };
});

vi.mock("@/lib/audio/cues", () => ({
  playDraftLockSound: vi.fn(),
  playJackpotIfPerfect: vi.fn(),
  playShowResultsSound: vi.fn(),
  playSpinStartSound: vi.fn(),
  playFinalRecordSound: vi.fn(),
}));

const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  resetSoundEngineForTests();
  window.localStorage.clear();
});

function emptyLineup(): GameStateView["lineup"] {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return slots.map((slot) => ({
    slot,
    accepts: slot === "WR1" || slot === "WR2" ? "WR" : slot,
    filled: false,
    player: null,
  }));
}

function activeGame(overrides: Partial<GameStateView> = {}): GameStateView {
  return {
    sessionId: "session-1",
    mode: "CLASSIC",
    status: "ACTIVE",
    isComplete: false,
    roundNumber: 1,
    nextRoundNumber: 1,
    openSlots: ["QB", "RB", "FB", "WR1", "WR2", "TE"],
    usefulPositions: ["QB", "RB", "FB", "WR", "TE"],
    teamSkipRemaining: 1,
    eraSkipRemaining: 1,
    lineup: emptyLineup(),
    ...overrides,
  };
}

function heapSpin(sessionId = "session-1"): SpinResult {
  return {
    sessionId,
    franchise: { id: 10, name: "Baltimore Ravens", abbreviation: "BAL" },
    era: { id: 4, label: "2000s" },
    openSlots: ["QB", "RB", "FB", "WR1", "WR2", "TE"],
    candidates: [
      {
        eligibleSlots: ["TE"],
        card: {
          cardId: 10,
          playerId: 10,
          playerName: "Todd Heap",
          franchiseId: 10,
          franchiseName: "Baltimore Ravens",
          franchiseAbbreviation: "BAL",
          eraId: 4,
          eraLabel: "2000s",
          positions: ["TE"],
          firstSeason: 2001,
          lastSeason: 2009,
          representativeSeason: 2005,
          draftable: true,
          production: {
            ...EMPTY_PRODUCTION,
            receptions: 446,
            receivingYards: 5127,
            receivingTouchdowns: 37,
          },
        },
      },
    ],
  };
}

function sfSpin(sessionId = "session-1"): SpinResult {
  return {
    sessionId,
    franchise: { id: 1, name: "San Francisco 49ers", abbreviation: "SF" },
    era: { id: 1, label: "1980s" },
    openSlots: ["QB", "RB", "FB", "WR1", "WR2", "TE"],
    candidates: [
      {
        eligibleSlots: ["QB"],
        card: {
          cardId: 99,
          playerId: 99,
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

describe("temporary QA controls on the real game", () => {
  let startCount: number;

  beforeEach(() => {
    startCount = 0;
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        const body = JSON.parse(String(init?.body ?? "{}")) as {
          sessionId?: string;
          action?: string;
          franchiseAbbreviation?: string;
          eraLabel?: string;
        };
        if (url.endsWith("/api/game/start")) {
          startCount += 1;
          return {
            ok: true,
            json: async () => ({ game: activeGame({ sessionId: `session-${startCount}` }) }),
          };
        }
        if (url.endsWith("/api/game/spin")) {
          return {
            ok: true,
            json: async () => ({
              game: activeGame({ sessionId: body.sessionId ?? "session-1" }),
              spin: sfSpin(body.sessionId),
            }),
          };
        }
        if (url.endsWith("/api/game/qa-spin")) {
          const sessionId = body.sessionId ?? "session-1";
          const spin = body.action === "force" ? heapSpin(sessionId) : sfSpin(sessionId);
          return {
            ok: true,
            json: async () => ({
              game: activeGame({ sessionId, teamSkipRemaining: 1, eraSkipRemaining: 1 }),
              spin,
            }),
          };
        }
        return {
          ok: false,
          json: async () => ({ error: { code: "INTERNAL_ERROR", message: "no" } }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows REROLL and BAL 2000s next to SOUND and NEW GAME", async () => {
    render(<GameApp />);
    expect(screen.getByRole("button", { name: /sound on/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /qa reroll/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /qa bal 2000s/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    await screen.findByRole("button", { name: /^spin$/i });
    expect(screen.getByRole("button", { name: /qa reroll/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /qa bal 2000s/i })).toBeInTheDocument();
  });

  it("forces BAL 2000s through the QA endpoint, not production SPIN", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /qa bal 2000s/i }));
    expect(await screen.findByText("Todd Heap")).toBeInTheDocument();
    expect(screen.getByText("BAL")).toBeInTheDocument();
    expect(screen.getByText("2000s")).toBeInTheDocument();
    expect(screen.getAllByText("1 remaining")).toHaveLength(2);

    const fetchMock = vi.mocked(fetch);
    const qaCalls = fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/api/game/qa-spin"));
    expect(qaCalls.length).toBeGreaterThan(0);
    expect(JSON.parse(String((qaCalls.at(-1)?.[1] as RequestInit | undefined)?.body ?? "{}"))).toMatchObject({
      action: "force",
      franchiseAbbreviation: "BAL",
      eraLabel: "2000s",
    });
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/api/game/spin"))).toHaveLength(0);
  });

  it("rerolls without posting to skip endpoints or production SPIN", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^spin$/i }));
    await screen.findByText("Joe Montana");

    fireEvent.click(screen.getByRole("button", { name: /qa reroll/i }));
    await waitFor(() => {
      const fetchMock = vi.mocked(fetch);
      expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/game/qa-spin"))).toBe(true);
    });

    const fetchMock = vi.mocked(fetch);
    const qaBodies = fetchMock.mock.calls
      .filter((call) => String(call[0]).endsWith("/api/game/qa-spin"))
      .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? "{}")) as { action?: string });
    expect(qaBodies.some((body) => body.action === "reroll")).toBe(true);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/game/team-skip"))).toBe(false);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith("/api/game/era-skip"))).toBe(false);
    expect(screen.getAllByText("1 remaining")).toHaveLength(2);
  });

  it("leaves the production SPIN button on the public spin endpoint", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^spin$/i }));
    await screen.findByText("Joe Montana");

    const spinCalls = vi
      .mocked(fetch)
      .mock.calls.filter((call) => String(call[0]).endsWith("/api/game/spin"));
    expect(spinCalls).toHaveLength(1);
    expect(JSON.parse(String((spinCalls[0]?.[1] as RequestInit | undefined)?.body ?? "{}"))).toEqual({
      sessionId: "session-1",
    });
  });

  it("preserves sound preference when using QA controls", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /sound on/i }));
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    fireEvent.click(screen.getByRole("button", { name: /qa bal 2000s/i }));
    await screen.findByText("Todd Heap");
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    expect(screen.getByRole("button", { name: /sound off/i })).toBeInTheDocument();
  });
});
