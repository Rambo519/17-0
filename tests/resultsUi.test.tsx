/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "@/components/game/GameApp";
import { ResultsPageClient } from "@/components/game/ResultsPageClient";
import { ResultsView } from "@/components/game/ResultsView";
import type { GameStateView } from "@/lib/game/view";
import type { ScoringResultView } from "@/lib/scoring/view";

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
});

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion: reduce"),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
  }));
}

function completedGame(mode: GameStateView["mode"] = "CLASSIC"): GameStateView {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return {
    sessionId: "session-1",
    mode,
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

function scoreFixture(overrides: Partial<ScoringResultView> = {}): ScoringResultView {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return {
    offenseRating: 87.4,
    weightedTalentRating: 86.0,
    balanceAdjustment: 1.2,
    expectedWins: 14.3,
    projectedWins: 14,
    projectedLosses: 3,
    perGameWinProbability: 0.892,
    perfectSeasonProbability: 0.158,
    dataConfidence: "HIGH",
    players: slots.map((slot) => ({
      playerName: `Player ${slot}`,
      lineupSlot: slot,
      position: slot === "WR1" || slot === "WR2" ? "WR" : slot,
      scoringSeason: 1994,
      rawProductionScore: 88,
      reliability: 1,
      overall: 84.5,
      productionScore: 84.5,
      percentileRank: 90,
      dataConfidence: "HIGH",
      metrics: [
        { key: "receiving_yards", rawValue: 1600, percentile: 92, weight: 0.4 },
      ],
    })),
    ...overrides,
  };
}

describe("ResultsView", () => {
  beforeEach(() => {
    stubReducedMotion(true);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the projected record, supporting metrics, and player breakdown", () => {
    render(
      <ResultsView
        game={completedGame()}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: /projected record/i })).toBeInTheDocument();
    expect(screen.getByText("14–3")).toBeInTheDocument();
    expect(screen.getByText("87.4")).toBeInTheDocument();
    expect(screen.getByText("14.3")).toBeInTheDocument();
    expect(screen.getByText("89.2%")).toBeInTheDocument();
    expect(screen.getByText("15.8%")).toBeInTheDocument();
    expect(screen.getAllByText(/High/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Player QB/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Season 1994/).length).toBe(6);
    expect(screen.getByText(/ALL-TIME OFFENSE/i)).toBeInTheDocument();
  });

  it("places the projected record and season metrics in two summary cards", () => {
    render(
      <ResultsView
        game={completedGame("IQ")}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    const recordCard = screen.getByRole("heading", { name: /projected record/i }).closest("section");
    const metricsCard = screen.getByLabelText(/season summary/i);
    expect(recordCard).toBeTruthy();
    expect(metricsCard).toBeTruthy();
    expect(recordCard).not.toBe(metricsCard);
    expect(recordCard?.parentElement).toBe(metricsCard.parentElement);
    expect(screen.getByText(/iq results/i)).toBeInTheDocument();
    expect(screen.getByText("Offense Rating")).toBeInTheDocument();
    expect(screen.getByText("Expected Wins")).toBeInTheDocument();
    expect(screen.getByText("Win Probability")).toBeInTheDocument();
    expect(screen.getByText("17–0 Chance")).toBeInTheDocument();
    expect(screen.getByText("Team Data Confidence")).toBeInTheDocument();
  });

  it("pairs the field and lineup in one lower results section", () => {
    render(
      <ResultsView
        game={completedGame("IQ")}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    const lineup = screen.getByRole("heading", { name: /^lineup$/i }).closest("section");
    const field = screen.getByRole("region", { name: /i-formation lineup/i });
    expect(lineup?.parentElement?.contains(field)).toBe(true);
    expect(screen.getAllByText("Player QB").length).toBeGreaterThan(1);
    expect(screen.getAllByText("84.5")).toHaveLength(6);
  });

  it("shows Classic production details and hides them in IQ mode", () => {
    const { rerender } = render(
      <ResultsView
        game={completedGame("CLASSIC")}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );
    expect(screen.getAllByText(/season production/i).length).toBeGreaterThan(0);

    rerender(
      <ResultsView
        game={completedGame("IQ")}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );
    expect(screen.queryByText(/season production/i)).not.toBeInTheDocument();
    expect(screen.getByText("14–3")).toBeInTheDocument();
    expect(screen.getAllByText(/Player QB/).length).toBeGreaterThan(0);
  });

  it("uses a jackpot presentation for a 17–0 projection", () => {
    render(
      <ResultsView
        game={completedGame()}
        score={scoreFixture({
          projectedWins: 17,
          projectedLosses: 0,
          expectedWins: 16.7,
          perGameWinProbability: 0.98,
          perfectSeasonProbability: 0.72,
        })}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByText("17–0")).toBeInTheDocument();
    expect(screen.getAllByText("17-0").length).toBeGreaterThan(1);
    expect(screen.getByText("17–0 Chance")).toBeInTheDocument();
    expect(screen.queryByText("16–0 Chance")).not.toBeInTheDocument();
  });

  it("does not use jackpot presentation for a 16–1 projection", () => {
    render(
      <ResultsView
        game={completedGame()}
        score={scoreFixture({
          projectedWins: 16,
          projectedLosses: 1,
          expectedWins: 15.8,
          perGameWinProbability: 0.93,
          perfectSeasonProbability: 0.3,
        })}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByText("16–1")).toBeInTheDocument();
    expect(screen.queryByText("17-0")).not.toBeInTheDocument();
    expect(screen.getByText("ALL-TIME OFFENSE")).toBeInTheDocument();
  });

  it("keeps the lineup visible while scoring loads", () => {
    render(
      <ResultsView
        game={completedGame()}
        score={null}
        scoreStatus="loading"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByText(/calculating season/i)).toBeInTheDocument();
    expect(screen.getByText("Player QB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /play again/i })).toBeInTheDocument();
  });

  it("shows a scoring failure and retry control", () => {
    const onRetry = vi.fn();
    render(
      <ResultsView
        game={completedGame()}
        score={null}
        scoreStatus="error"
        errorMessage="Could not calculate this season. Try again."
        onRetry={onRetry}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByText(/could not calculate this season/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });
});

describe("ResultsView record count", () => {
  beforeEach(() => {
    stubReducedMotion(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("animates the projected record up to the server value", async () => {
    render(
      <ResultsView
        game={completedGame()}
        score={scoreFixture()}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    expect(screen.getByText("0–17")).toBeInTheDocument();
    expect(screen.getByText(/calculating season/i)).toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(1600);
    expect(screen.getByText("14–3")).toBeInTheDocument();
  });

  it("holds 16-1 then lands on 17-0 for a perfect projection", async () => {
    render(
      <ResultsView
        game={completedGame()}
        score={scoreFixture({
          projectedWins: 17,
          projectedLosses: 0,
          expectedWins: 16.7,
          perGameWinProbability: 0.98,
          perfectSeasonProbability: 0.72,
        })}
        scoreStatus="ready"
        errorMessage={null}
        onRetry={() => undefined}
        onPlayAgain={() => undefined}
        onBackToLineup={() => undefined}
      />,
    );

    await vi.advanceTimersByTimeAsync(1250);
    expect(screen.getByText("16–1")).toBeInTheDocument();
    expect(screen.queryByText("17–0")).not.toBeInTheDocument();
    await vi.advanceTimersByTimeAsync(400);
    expect(screen.getByText("17–0")).toBeInTheDocument();
    expect(screen.getAllByText("17-0").length).toBeGreaterThan(0);
  });
});

describe("ResultsPageClient", () => {
  beforeEach(() => {
    stubReducedMotion(true);
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith("/api/game/session-1/score")) {
          return {
            ok: true,
            json: async () => scoreFixture(),
          };
        }
        if (url.endsWith("/api/game/session-1")) {
          return {
            ok: true,
            json: async () => ({ game: completedGame(), spin: null }),
          };
        }
        return { ok: false, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "no" } }) };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the completed session and score API on the dedicated results route", async () => {
    render(<ResultsPageClient sessionId="session-1" />);

    expect(await screen.findByText("14–3")).toBeInTheDocument();
    expect(screen.getByText("87.4")).toBeInTheDocument();

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith("/api/game/session-1");
    expect(fetchMock).toHaveBeenCalledWith("/api/game/session-1/score");
  });

  it("retries the score API after a failure without dropping the lineup", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/score")) {
        if (fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/score")).length === 1) {
          return {
            ok: false,
            json: async () => ({ error: { code: "SCORING_ERROR", message: "boom" } }),
          };
        }
        return { ok: true, json: async () => scoreFixture() };
      }
      return { ok: true, json: async () => ({ game: completedGame(), spin: null }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ResultsPageClient sessionId="session-1" />);

    expect(await screen.findByRole("button", { name: /try again/i })).toBeInTheDocument();
    expect(screen.getByText("Player QB")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(await screen.findByText("14–3")).toBeInTheDocument();
  });

  it("sends Play Again back to the home game flow", async () => {
    render(<ResultsPageClient sessionId="session-1" />);
    expect(await screen.findByText("14–3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(push).toHaveBeenCalledWith("/");
  });

  it("returns to the completed lineup route from Back to Lineup", async () => {
    render(<ResultsPageClient sessionId="session-1" />);
    expect(await screen.findByText("14–3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /back to lineup/i }));
    expect(push).toHaveBeenCalledWith("/game/session-1");
  });
});

describe("GameApp results navigation", () => {
  beforeEach(() => {
    push.mockReset();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ game: completedGame() }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens the results route when View Results is pressed on a completed game", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    expect(await screen.findByRole("heading", { name: /offense complete/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view results/i }));
    expect(push).toHaveBeenCalledWith("/game/session-1/results");
  });

  it("returns to the simplified start screen when Play Again is pressed", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: /prove it/i }));
    expect(await screen.findByRole("heading", { name: /offense complete/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(screen.getByRole("heading", { name: /test your football iq/i })).toBeInTheDocument();
  });
});
