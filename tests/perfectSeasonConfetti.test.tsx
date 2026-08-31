/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PerfectSeasonConfetti } from "@/components/game/PerfectSeasonConfetti";

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

async function flushConfettiStart() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("PerfectSeasonConfetti", () => {
  beforeEach(() => {
    stubReducedMotion(false);
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("bursts once from a portal overlay and then removes itself", async () => {
    const { rerender } = render(<PerfectSeasonConfetti />);
    await flushConfettiStart();
    expect(screen.getByTestId("perfect-season-confetti")).toBeInTheDocument();
    expect(screen.getByTestId("perfect-season-confetti")).toHaveAttribute("aria-hidden", "true");

    rerender(<PerfectSeasonConfetti />);
    expect(screen.getAllByTestId("perfect-season-confetti")).toHaveLength(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(screen.queryByTestId("perfect-season-confetti")).not.toBeInTheDocument();

    rerender(<PerfectSeasonConfetti />);
    expect(screen.queryByTestId("perfect-season-confetti")).not.toBeInTheDocument();
  });

  it("skips the animation when reduced motion is preferred", async () => {
    stubReducedMotion(true);
    render(<PerfectSeasonConfetti />);
    await flushConfettiStart();
    expect(screen.queryByTestId("perfect-season-confetti")).not.toBeInTheDocument();
  });
});
