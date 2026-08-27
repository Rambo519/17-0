/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GameHeader } from "@/components/game/GameHeader";
import { ModeSelector } from "@/components/game/ModeSelector";
import { QaControls } from "@/components/game/QaControls";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.doUnmock("@/lib/game/qaAccess");
});

describe("QaControls production guard", () => {
  it("does not render in production", async () => {
    vi.resetModules();
    vi.doMock("@/lib/game/qaAccess", () => ({
      isDevelopmentQaEnabled: () => false,
    }));
    const { QaControls: ProductionQaControls } = await import("@/components/game/QaControls");
    render(<ProductionQaControls onReroll={() => undefined} onBal2000s={() => undefined} />);
    expect(screen.queryByRole("group", { name: /development qa/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /qa reroll/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /qa bal 2000s/i })).not.toBeInTheDocument();
    vi.doUnmock("@/lib/game/qaAccess");
    vi.resetModules();
  });

  it("renders compact controls in development when handlers are provided", () => {
    render(<QaControls onReroll={() => undefined} onBal2000s={() => undefined} />);
    expect(screen.getByRole("group", { name: /development qa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /qa reroll/i })).toHaveTextContent(/reroll/i);
    expect(screen.getByRole("button", { name: /qa bal 2000s/i })).toHaveTextContent(/bal 2000s/i);
  });

  it("renders nothing without handlers even in development", () => {
    render(<QaControls />);
    expect(screen.queryByRole("group", { name: /development qa/i })).not.toBeInTheDocument();
  });
});

describe("GameHeader and ModeSelector production-safe defaults", () => {
  it("hides QA on GameHeader when callbacks are omitted", () => {
    render(
      <GameHeader mode="CLASSIC" roundNumber={1} filledCount={0} isComplete={false} />,
    );
    expect(screen.queryByRole("button", { name: /qa reroll/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /qa bal 2000s/i })).not.toBeInTheDocument();
  });

  it("hides QA on ModeSelector when callbacks are omitted", () => {
    render(
      <ModeSelector onStart={() => undefined} busy={false} />,
    );
    expect(screen.queryByRole("button", { name: /qa reroll/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /qa bal 2000s/i })).not.toBeInTheDocument();
  });
});
