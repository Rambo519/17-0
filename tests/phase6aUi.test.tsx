/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "@/components/game/GameApp";
import { ResultsPageClient } from "@/components/game/ResultsPageClient";
import { SoundToggle } from "@/components/game/SoundToggle";
import { SpinPanel } from "@/components/game/SpinPanel";
import { playDraftLockSound, playFinalRecordSound, playSpinStartSound } from "@/lib/audio/cues";
import { SOUND_STORAGE_KEY } from "@/lib/audio/events";
import { resetSoundEngineForTests } from "@/lib/audio/soundEngine";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { SpinResult } from "@/lib/game/spin";
import type { SpinRevealFrame } from "@/lib/game/spinReveal";
import type { GameStateView } from "@/lib/game/view";
import type { ScoringResultView } from "@/lib/scoring/view";

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

function qbSpin(): SpinResult {
  return {
    sessionId: "session-1",
    franchise: { id: 1, name: "San Francisco 49ers", abbreviation: "SF" },
    era: { id: 1, label: "1980s" },
    openSlots: ["QB", "RB", "FB", "WR1", "WR2", "TE"],
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

function cyclingReveal(): SpinRevealFrame {
  return {
    abbreviation: "DAL",
    franchiseName: "Dallas Cowboys",
    eraLabel: "1990s",
    teamLocked: false,
    eraLocked: false,
    showCandidates: false,
    cycling: true,
  };
}

function scoreFixture(overrides: Partial<ScoringResultView> = {}): ScoringResultView {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return {
    offenseRating: 99,
    weightedTalentRating: 99,
    balanceAdjustment: 0,
    expectedWins: 17,
    projectedWins: 17,
    projectedLosses: 0,
    perGameWinProbability: 0.99,
    perfectSeasonProbability: 0.9,
    dataConfidence: "HIGH",
    players: slots.map((slot) => ({
      playerName: `Player ${slot}`,
      lineupSlot: slot,
      position: slot === "WR1" || slot === "WR2" ? "WR" : slot,
      scoringSeason: 1994,
      rawProductionScore: 99,
      reliability: 1,
      overall: 99,
      productionScore: 99,
      percentileRank: 99,
      dataConfidence: "HIGH",
      metrics: [],
    })),
    ...overrides,
  };
}

function completedGame(): GameStateView {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return {
    sessionId: "session-1",
    mode: "CLASSIC",
    status: "COMPLETE",
    isComplete: true,
    roundNumber: 6,
    nextRoundNumber: 7,
    openSlots: [],
    usefulPositions: [],
    teamSkipRemaining: 1,
    eraSkipRemaining: 1,
    lineup: slots.map((slot, index) => ({
      slot,
      accepts: slot === "WR1" || slot === "WR2" ? "WR" : slot,
      filled: true,
      player: {
        playerId: index + 1,
        playerName: `Player ${slot}`,
        franchiseName: "San Francisco 49ers",
        franchiseAbbreviation: "SF",
        eraLabel: "1990s",
        roundNumber: index + 1,
      },
    })),
  };
}

describe("SpinPanel reveal gating", () => {
  it("hides candidates until the reveal completes", () => {
    const onSpin = vi.fn();
    const { rerender } = render(
      <SpinPanel
        mode="CLASSIC"
        spin={qbSpin()}
        reveal={cyclingReveal()}
        selectedCardId={null}
        teamSkipRemaining={1}
        eraSkipRemaining={1}
        busy
        spinning
        isComplete={false}
        onSpin={onSpin}
        onTeamSkip={() => undefined}
        onEraSkip={() => undefined}
        onSelectCandidate={() => undefined}
      />,
    );

    expect(screen.queryByText("Joe Montana")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /spinning/i })).toBeDisabled();
    expect(onSpin).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /spinning/i }));
    expect(onSpin).not.toHaveBeenCalled();

    rerender(
      <SpinPanel
        mode="CLASSIC"
        spin={qbSpin()}
        reveal={{
          abbreviation: "SF",
          franchiseName: "San Francisco 49ers",
          eraLabel: "1980s",
          teamLocked: true,
          eraLocked: true,
          showCandidates: true,
          cycling: false,
        }}
        selectedCardId={null}
        teamSkipRemaining={1}
        eraSkipRemaining={1}
        busy={false}
        spinning={false}
        isComplete={false}
        onSpin={onSpin}
        onTeamSkip={() => undefined}
        onEraSkip={() => undefined}
        onSelectCandidate={() => undefined}
      />,
    );

    expect(screen.getByText("Joe Montana")).toBeInTheDocument();
    expect(screen.getByText("SF")).toBeInTheDocument();
    expect(screen.getByText("1980s")).toBeInTheDocument();
  });
});

describe("SoundToggle", () => {
  beforeEach(() => {
    resetSoundEngineForTests();
    window.localStorage.clear();
  });

  it("persists sound off across a remount", () => {
    const { unmount } = render(<SoundToggle />);
    fireEvent.click(screen.getByRole("button", { name: /sound on/i }));
    expect(window.localStorage.getItem(SOUND_STORAGE_KEY)).toBe("off");
    unmount();
    resetSoundEngineForTests();
    render(<SoundToggle />);
    expect(screen.getByRole("button", { name: /sound off/i })).toBeInTheDocument();
  });
});

describe("GameApp spin and draft sounds", () => {
  beforeEach(() => {
    push.mockReset();
    vi.mocked(playDraftLockSound).mockClear();
    vi.mocked(playSpinStartSound).mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/game/start")) {
          return { ok: true, json: async () => ({ game: activeGame() }) };
        }
        if (url.endsWith("/api/game/spin")) {
          return { ok: true, json: async () => ({ game: activeGame(), spin: qbSpin() }) };
        }
        if (url.endsWith("/api/game/pick")) {
          return {
            ok: true,
            json: async () => ({
              game: activeGame({
                roundNumber: 2,
                nextRoundNumber: 2,
                openSlots: ["RB", "FB", "WR1", "WR2", "TE"],
                usefulPositions: ["RB", "FB", "WR", "TE"],
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
              }),
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

  it("does not submit duplicate spin requests", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    const spin = await screen.findByRole("button", { name: /^spin$/i });
    fireEvent.click(spin);
    fireEvent.click(spin);
    await screen.findByText("Joe Montana");
    const fetchMock = vi.mocked(fetch);
    const spinPosts = fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/api/game/spin"));
    expect(spinPosts).toHaveLength(1);
  });

  it("plays the spin start cue exactly once per SPIN click", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    const spin = await screen.findByRole("button", { name: /^spin$/i });
    fireEvent.click(spin);
    await screen.findByText("Joe Montana");
    expect(playSpinStartSound).toHaveBeenCalledTimes(1);
  });

  it("plays draft lock only after a successful committed pick", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^spin$/i }));
    const candidate = await screen.findByRole("button", { name: /joe montana/i });
    fireEvent.click(candidate);
    expect(playDraftLockSound).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /qb empty, eligible/i }));
    await waitFor(() => expect(playDraftLockSound).toHaveBeenCalledTimes(1));
  });
});

describe("ResultsPageClient jackpot cue", () => {
  beforeEach(() => {
    vi.mocked(playFinalRecordSound).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fires jackpot only for a server-projected 17-0 season", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/game/session-1")) {
          return { ok: true, json: async () => ({ game: completedGame(), spin: null }) };
        }
        if (url.endsWith("/api/game/session-1/score")) {
          return { ok: true, json: async () => scoreFixture() };
        }
        return { ok: false, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "no" } }) };
      }),
    );

    render(<ResultsPageClient sessionId="session-1" />);
    expect(await screen.findByText("17–0", {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(playFinalRecordSound).toHaveBeenCalledWith(17), { timeout: 4000 });
  });

  it("does not fire jackpot for a 16-1 projection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/game/session-1")) {
          return { ok: true, json: async () => ({ game: completedGame(), spin: null }) };
        }
        if (url.endsWith("/api/game/session-1/score")) {
          return {
            ok: true,
            json: async () => scoreFixture({ projectedWins: 16, projectedLosses: 1, expectedWins: 15.8 }),
          };
        }
        return { ok: false, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "no" } }) };
      }),
    );

    render(<ResultsPageClient sessionId="session-1" />);
    expect(await screen.findByText("16–1", {}, { timeout: 4000 })).toBeInTheDocument();
    await waitFor(() => expect(playFinalRecordSound).toHaveBeenCalledWith(16), { timeout: 4000 });
    expect(vi.mocked(playFinalRecordSound).mock.calls.every((call) => call[0] === 16)).toBe(true);
  });
});
