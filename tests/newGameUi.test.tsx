/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "@/components/game/GameApp";
import { SOUND_STORAGE_KEY } from "@/lib/audio/events";
import { resetSoundEngineForTests } from "@/lib/audio/soundEngine";
import { LINEUP_SLOTS, positionForSlot } from "@/lib/football/positions";
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
  return LINEUP_SLOTS.map((slot) => ({
    slot,
    accepts: positionForSlot(slot),
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
    openSlots: ["QB", "RB1", "RB2", "WR1", "WR2", "TE"],
    usefulPositions: ["QB", "RB", "WR", "TE"],
    teamSkipRemaining: 1,
    eraSkipRemaining: 1,
    lineup: emptyLineup(),
    ...overrides,
  };
}

function qbSpin(sessionId = "session-1"): SpinResult {
  return {
    sessionId,
    franchise: { id: 1, name: "San Francisco 49ers", abbreviation: "SF" },
    era: { id: 1, label: "1980s" },
    openSlots: ["QB", "RB1", "RB2", "WR1", "WR2", "TE"],
    candidates: [
      {
        eligibleSlots: ["QB"],
        card: {
          cardId: 10,
          playerId: 10,
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

function pickedGame(sessionId: string): GameStateView {
  return activeGame({
    sessionId,
    roundNumber: 2,
    nextRoundNumber: 2,
    teamSkipRemaining: 0,
    eraSkipRemaining: 0,
    openSlots: ["RB1", "RB2", "WR1", "WR2", "TE"],
    usefulPositions: ["RB", "WR", "TE"],
    lineup: emptyLineup().map((slot) =>
      slot.slot === "QB"
        ? {
            ...slot,
            filled: true,
            player: {
              playerId: 10,
              playerName: "Joe Montana",
              franchiseName: "San Francisco 49ers",
              franchiseAbbreviation: "SF",
              eraLabel: "1980s",
              roundNumber: 1,
            },
          }
        : slot,
    ),
  });
}

describe("NEW GAME control", () => {
  let startCount: number;

  beforeEach(() => {
    startCount = 0;
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/game/start")) {
          startCount += 1;
          const body = JSON.parse(String(init?.body ?? "{}")) as { mode?: GameStateView["mode"] };
          return {
            ok: true,
            json: async () => ({
              game: activeGame({
                sessionId: `session-${startCount}`,
                mode: body.mode === "IQ" ? "IQ" : "CLASSIC",
              }),
            }),
          };
        }
        if (url.endsWith("/api/game/spin")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { sessionId?: string };
          return {
            ok: true,
            json: async () => ({
              game: activeGame({ sessionId: body.sessionId ?? "session-1" }),
              spin: qbSpin(body.sessionId),
            }),
          };
        }
        if (url.endsWith("/api/game/pick")) {
          return {
            ok: true,
            json: async () => ({ game: pickedGame("session-1") }),
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

  it("returns to the start screen from pre-spin without confirmation", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);

    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    expect(await screen.findByRole("button", { name: /^spin$/i })).toBeInTheDocument();
    expect(screen.getByText(/round 1 of 6/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(confirm).not.toHaveBeenCalled();
    expect(startCount).toBe(1);
    expect(screen.getByRole("heading", { name: /test your football iq/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /prove it/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^spin$/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Joe Montana")).not.toBeInTheDocument();
  });

  it("clears the in-progress game after confirmation and returns to start", async () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal("confirm", confirm);

    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    const spin = await screen.findByRole("button", { name: /^spin$/i });
    fireEvent.click(spin);
    const candidate = await screen.findByRole("button", { name: /joe montana/i });
    fireEvent.click(candidate);
    fireEvent.click(screen.getByRole("button", { name: /qb empty, eligible/i }));

    expect(await screen.findByLabelText(/qb filled by joe montana/i)).toBeInTheDocument();
    expect(screen.getByText(/round 2 of 6/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(confirm).toHaveBeenCalledWith("Start a new game? Current picks will be cleared.");
    expect(startCount).toBe(1);
    expect(screen.getByRole("heading", { name: /test your football iq/i })).toBeInTheDocument();
    expect(screen.queryByText("Joe Montana")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    await waitFor(() => expect(startCount).toBe(2));
    fireEvent.click(await screen.findByRole("button", { name: /^spin$/i }));
    await screen.findByText("Joe Montana");
    expect(screen.getAllByText("1 remaining")).toHaveLength(2);
    expect(screen.queryByText("Used")).not.toBeInTheDocument();
  });

  it("leaves the current game alone when confirmation is cancelled", async () => {
    const confirm = vi.fn(() => false);
    vi.stubGlobal("confirm", confirm);

    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^spin$/i }));
    fireEvent.click(await screen.findByRole("button", { name: /joe montana/i }));
    fireEvent.click(screen.getByRole("button", { name: /qb empty, eligible/i }));
    expect(await screen.findByText(/round 2 of 6/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(confirm).toHaveBeenCalled();
    expect(startCount).toBe(1);
    expect(screen.getByText(/round 2 of 6/i)).toBeInTheDocument();
    expect(screen.getByText("Joe Montana")).toBeInTheDocument();
  });

  it("preserves sound preference across a new game", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /sound on/i }));
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");

    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    await screen.findByRole("button", { name: /^spin$/i });
    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(screen.getByRole("heading", { name: /test your football iq/i })).toBeInTheDocument();
    expect(startCount).toBe(1);

    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    expect(screen.getByRole("button", { name: /sound off/i })).toBeInTheDocument();
  });

  it("starts IQ from PROVE IT and uses the public spin endpoint after NEW GAME", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    await screen.findByRole("button", { name: /^spin$/i });
    expect(screen.getByText("IQ")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(screen.getByRole("heading", { name: /test your football iq/i })).toBeInTheDocument();
    expect(startCount).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    await waitFor(() => expect(startCount).toBe(2));
    expect(screen.getByText("IQ")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^spin$/i }));
    await screen.findByText("Joe Montana");

    const fetchMock = vi.mocked(fetch);
    const startBodies = fetchMock.mock.calls
      .filter((call) => String(call[0]).endsWith("/api/game/start"))
      .map((call) => JSON.parse(String((call[1] as RequestInit | undefined)?.body ?? "{}")) as { mode?: string });
    expect(startBodies.every((body) => body.mode === "IQ")).toBe(true);

    const spinCalls = fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/api/game/spin"));
    expect(spinCalls).toHaveLength(1);
    expect(JSON.parse(String((spinCalls[0]?.[1] as RequestInit | undefined)?.body ?? "{}"))).toEqual({
      sessionId: "session-2",
    });
  });
});
