/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameHeader } from "@/components/game/GameHeader";
import { ModeSelector } from "@/components/game/ModeSelector";
import { ShareButton } from "@/components/game/ShareButton";
import { SHARE_INVITE } from "@/lib/brand";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function stubShare(share: unknown, canShare?: unknown) {
  Object.defineProperty(navigator, "share", {
    configurable: true,
    writable: true,
    value: share,
  });
  Object.defineProperty(navigator, "canShare", {
    configurable: true,
    writable: true,
    value: canShare,
  });
}

function stubClipboard(writeText: unknown) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    writable: true,
    value: { writeText },
  });
}

describe("ShareButton", () => {
  beforeEach(() => {
    stubShare(undefined);
    stubClipboard(undefined);
  });

  it("opens the native share sheet with the origin invite and no record", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    stubShare(share, () => true);
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await waitFor(() => expect(share).toHaveBeenCalledTimes(1));
    const payload = share.mock.calls[0]![0] as { title: string; text: string; url: string };
    expect(payload.url).toBe(`${window.location.origin}/`);
    expect(payload.url).not.toMatch(/game\//);
    expect(payload.text).toBe(SHARE_INVITE);
    expect(JSON.stringify(payload)).not.toMatch(/14–3|16–1|17–0 Chance/i);
  });

  it("copies the plain origin link when Web Share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubShare(undefined);
    stubClipboard(writeText);
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/`));
    expect(await screen.findByRole("button", { name: /link copied/i })).toBeInTheDocument();
    expect(screen.getByText("Copied")).toBeInTheDocument();
  });

  it("does not copy when the user cancels the share sheet", async () => {
    const abort = Object.assign(new Error("canceled"), { name: "AbortError" });
    const share = vi.fn().mockRejectedValue(abort);
    const writeText = vi.fn();
    stubShare(share, () => true);
    stubClipboard(writeText);
    render(<ShareButton />);
    fireEvent.click(screen.getByRole("button", { name: /^share$/i }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(writeText).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();
  });
});

describe("share control placement", () => {
  it("sits in the landing header row with sound and new game", () => {
    render(<ModeSelector onStart={() => undefined} onNewGame={() => undefined} busy={false} />);
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sound on/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
  });

  it("sits in the results header row, not the jackpot record hero", () => {
    render(
      <GameHeader
        mode="IQ"
        roundNumber={6}
        filledCount={6}
        isComplete
        onNewGame={() => undefined}
      />,
    );
    expect(screen.getByRole("button", { name: /^share$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sound on/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /new game/i })).toBeInTheDocument();
  });
});
