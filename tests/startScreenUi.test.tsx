/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameApp } from "@/components/game/GameApp";
import shell from "@/components/game/game.module.css";
import {
  ModeSelector,
  START_ACTION_LABEL,
  START_HEADLINE,
  START_SUBTITLE,
} from "@/components/game/ModeSelector";
import { LINEUP_SLOTS, positionForSlot } from "@/lib/football/positions";
import { startGame } from "@/lib/game/startGame";
import { createInMemoryGameRepository, skipScenarioCards } from "./helpers/inMemoryGameRepository";
import type { GameStateView } from "@/lib/game/view";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
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
    mode: "IQ",
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

describe("player-facing start screen", () => {
  it("shows the IQ challenge copy and a single PROVE IT action", () => {
    const onStart = vi.fn();
    render(<ModeSelector onStart={onStart} busy={false} />);

    expect(screen.getByRole("heading", { name: START_HEADLINE })).toBeInTheDocument();
    expect(screen.getByText(START_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: START_ACTION_LABEL })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: START_ACTION_LABEL })).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();

    expect(screen.queryByRole("radiogroup", { name: /game mode/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /classic/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/classic locked/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/iq mode/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/see historical production while you draft/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no statistical help/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /start game/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: START_ACTION_LABEL }));
    expect(onStart).toHaveBeenCalledTimes(1);
  });

  it("shows a quiet version footer with the app name, version, and copyright year", () => {
    render(<ModeSelector onStart={() => undefined} busy={false} appVersion="b3b447b" />);
    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("17-0");
    expect(footer).toHaveTextContent("b3b447b");
    expect(footer).toHaveTextContent(`© ${new Date().getFullYear()}`);
    expect(screen.getByRole("button", { name: START_ACTION_LABEL })).toBeInTheDocument();
  });
});

describe("PROVE IT starts an IQ game", () => {
  let startBodies: Array<{ mode?: string }>;

  beforeEach(() => {
    startBodies = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith("/api/game/start")) {
          const body = JSON.parse(String(init?.body ?? "{}")) as { mode?: string };
          startBodies.push(body);
          return {
            ok: true,
            json: async () => ({
              game: activeGame({ mode: body.mode === "IQ" ? "IQ" : "CLASSIC" }),
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

  it("starts through the existing start-game API with mode IQ", async () => {
    render(<GameApp />);
    expect(screen.getByRole("button", { name: /sound on/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: START_ACTION_LABEL }));
    expect(await screen.findByText("IQ")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /^spin$/i })).toBeInTheDocument();
    expect(startBodies).toEqual([{ mode: "IQ" }]);
  });

  it("uses the full-bleed landing shell only on the start screen", async () => {
    const landingClass = shell.landing;
    if (landingClass === undefined) {
      throw new Error("game.module.css must export a landing class");
    }

    render(<GameApp />);
    expect(document.querySelector("main")?.classList.contains(landingClass)).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: START_ACTION_LABEL }));
    expect(await screen.findByRole("button", { name: /^spin$/i })).toBeInTheDocument();
    expect(document.querySelector("main")?.classList.contains(landingClass)).toBe(false);
  });

  it("returns to the simplified start screen on NEW GAME", async () => {
    render(<GameApp />);
    fireEvent.click(screen.getByRole("button", { name: START_ACTION_LABEL }));
    expect(await screen.findByRole("button", { name: /^spin$/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /new game/i }));
    expect(screen.getByRole("heading", { name: START_HEADLINE })).toBeInTheDocument();
    expect(screen.getByText(START_SUBTITLE)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: START_ACTION_LABEL })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^spin$/i })).not.toBeInTheDocument();
    expect(startBodies).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: START_ACTION_LABEL }));
    await waitFor(() => expect(startBodies).toEqual([{ mode: "IQ" }, { mode: "IQ" }]));
  });
});

describe("CLASSIC remains available internally", () => {
  it("still starts CLASSIC sessions through the game engine", async () => {
    const repository = createInMemoryGameRepository(skipScenarioCards());
    const state = await startGame(repository, { mode: "CLASSIC" });
    expect(state.mode).toBe("CLASSIC");
  });
});
