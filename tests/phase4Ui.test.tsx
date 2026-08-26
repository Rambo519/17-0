/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CandidateCard } from "@/components/game/CandidateCard";
import { CandidateList } from "@/components/game/CandidateList";
import { CompletedLineup } from "@/components/game/CompletedLineup";
import { FormationField } from "@/components/game/FormationField";
import { ModeSelector } from "@/components/game/ModeSelector";
import { SkipControls } from "@/components/game/SkipControls";
import { EMPTY_PRODUCTION } from "@/lib/game/production";
import type { SpinCandidate } from "@/lib/game/spin";
import type { LineupSlotView } from "@/lib/game/view";

afterEach(() => {
  cleanup();
});

function lineupFixture(filled: Partial<Record<string, true>> = {}): LineupSlotView[] {
  const slots = ["QB", "RB", "FB", "WR1", "WR2", "TE"] as const;
  return slots.map((slot) => ({
    slot,
    accepts: slot === "WR1" || slot === "WR2" ? "WR" : slot,
    filled: Boolean(filled[slot]),
    player: filled[slot]
      ? {
          playerId: 1,
          playerName: `Locked ${slot}`,
          franchiseName: "San Francisco 49ers",
          franchiseAbbreviation: "SF",
          eraLabel: "1980s",
          roundNumber: 1,
        }
      : null,
  }));
}

function wrCandidate(): SpinCandidate {
  return {
    eligibleSlots: ["WR1", "WR2"],
    card: {
      cardId: 10,
      playerId: 10,
      playerName: "Jerry Rice",
      franchiseId: 1,
      franchiseName: "San Francisco 49ers",
      franchiseAbbreviation: "SF",
      eraId: 1,
      eraLabel: "1980s",
      positions: ["WR"],
      firstSeason: 1985,
      lastSeason: 1989,
      representativeSeason: 1987,
      draftable: true,
      production: {
        ...EMPTY_PRODUCTION,
        games: 70,
        receptions: 400,
        receivingYards: 7000,
        receivingTouchdowns: 70,
      },
    },
  };
}

describe("ModeSelector", () => {
  it("lets the user choose CLASSIC or IQ before starting", () => {
    const onModeChange = vi.fn();
    const onStart = vi.fn();
    render(
      <ModeSelector mode="CLASSIC" onModeChange={onModeChange} onStart={onStart} busy={false} />,
    );

    expect(screen.getAllByText("17-0").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /build the perfect offense/i })).toBeInTheDocument();
    expect(screen.getByText(/see historical production while you draft/i)).toBeInTheDocument();
    expect(screen.getByText(/no statistical help\. trust your football knowledge/i)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /classic/i })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /iq/i }));
    expect(onModeChange).toHaveBeenCalledWith("IQ");
    fireEvent.click(screen.getByRole("button", { name: /start game/i }));
    expect(onStart).toHaveBeenCalled();
  });

  it("supports keyboard selection between Classic and IQ", () => {
    const onModeChange = vi.fn();
    render(
      <ModeSelector mode="CLASSIC" onModeChange={onModeChange} onStart={() => undefined} busy={false} />,
    );
    fireEvent.keyDown(screen.getByRole("radiogroup"), { key: "ArrowRight" });
    expect(onModeChange).toHaveBeenCalledWith("IQ");
  });
});

describe("CandidateCard", () => {
  it("shows Classic production and hides it in IQ mode", () => {
    const candidate = wrCandidate();
    const { rerender } = render(
      <CandidateCard candidate={candidate} mode="CLASSIC" selected={false} onSelect={() => undefined} />,
    );
    expect(screen.getByText("Jerry Rice")).toBeInTheDocument();
    expect(screen.getByText("Rec Yds")).toBeInTheDocument();
    expect(screen.getByText("7,000")).toBeInTheDocument();

    rerender(
      <CandidateCard candidate={candidate} mode="IQ" selected={false} onSelect={() => undefined} />,
    );
    expect(screen.getByText("Jerry Rice")).toBeInTheDocument();
    expect(screen.getByText("Can fill: WR1, WR2")).toBeInTheDocument();
    expect(screen.queryByText("Rec Yds")).not.toBeInTheDocument();
    expect(screen.queryByText("7,000")).not.toBeInTheDocument();
  });

  it("presents comma-stored names as First Last", () => {
    const candidate = wrCandidate();
    candidate.card.playerName = "Rice, Jerry";
    render(
      <CandidateCard candidate={candidate} mode="IQ" selected={false} onSelect={() => undefined} />,
    );
    expect(screen.getByText("Jerry Rice")).toBeInTheDocument();
    expect(screen.queryByText("Rice, Jerry")).not.toBeInTheDocument();
  });

  it("marks a candidate as selected when pressed", () => {
    const onSelect = vi.fn();
    render(
      <CandidateCard candidate={wrCandidate()} mode="IQ" selected onSelect={onSelect} />,
    );
    const button = screen.getByRole("button", { name: /jerry rice/i });
    expect(button).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(button);
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("CandidateList", () => {
  it("keeps server order and hides production in IQ mode", () => {
    const rice = wrCandidate();
    const later = wrCandidate();
    later.card.cardId = 11;
    later.card.playerId = 11;
    later.card.playerName = "Aaron Rodgers";
    later.card.production = { ...EMPTY_PRODUCTION, receivingYards: 500 };

    render(
      <CandidateList
        candidates={[rice, later]}
        mode="IQ"
        selectedCardId={null}
        onSelect={() => undefined}
      />,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons[0]).toHaveTextContent("Jerry Rice");
    expect(buttons[1]).toHaveTextContent("Aaron Rodgers");
    expect(screen.queryByText("Rec Yds")).not.toBeInTheDocument();
    expect(screen.queryByText("7,000")).not.toBeInTheDocument();
  });
});

describe("FormationField", () => {
  it("highlights eligible empty WR slots and keeps filled slots locked", () => {
    const onSelectSlot = vi.fn();
    render(
      <FormationField
        lineup={lineupFixture({ WR1: true })}
        highlightedSlots={["WR2"]}
        onSelectSlot={onSelectSlot}
      />,
    );

    expect(screen.getByText("Locked WR1")).toBeInTheDocument();
    const emptyWr = screen.getByRole("button", { name: /wr empty, eligible/i });
    fireEvent.click(emptyWr);
    expect(onSelectSlot).toHaveBeenCalledWith("WR2");

    // Filled slot is not a button.
    expect(screen.queryByRole("button", { name: /locked wr1/i })).not.toBeInTheDocument();
  });

  it("does not allow clicking non-highlighted empty slots", () => {
    const onSelectSlot = vi.fn();
    render(
      <FormationField
        lineup={lineupFixture()}
        highlightedSlots={["RB"]}
        onSelectSlot={onSelectSlot}
      />,
    );
    const qb = screen.getByRole("button", { name: /^qb empty$/i });
    expect(qb).toBeDisabled();
    fireEvent.click(qb);
    expect(onSelectSlot).not.toHaveBeenCalled();
  });
});

describe("SkipControls", () => {
  it("shows remaining counts and used state", () => {
    const onTeamSkip = vi.fn();
    const onEraSkip = vi.fn();
    render(
      <SkipControls
        teamSkipRemaining={1}
        eraSkipRemaining={0}
        disabled={false}
        busy={false}
        onTeamSkip={onTeamSkip}
        onEraSkip={onEraSkip}
      />,
    );

    expect(screen.getByText("1 remaining")).toBeInTheDocument();
    expect(screen.getByText("Used")).toBeInTheDocument();
    const era = screen.getByRole("button", { name: /reroll era/i });
    expect(era).toBeDisabled();
    expect(screen.getByRole("button", { name: /reroll team/i })).toBeEnabled();
  });
});

describe("CompletedLineup", () => {
  it("shows the completion state and View Results action", () => {
    const onNewGame = vi.fn();
    const onViewResults = vi.fn();
    render(
      <CompletedLineup
        lineup={lineupFixture({ QB: true, RB: true, FB: true, WR1: true, WR2: true, TE: true })}
        onNewGame={onNewGame}
        onViewResults={onViewResults}
      />,
    );

    expect(screen.getByRole("heading", { name: /offense complete/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /view results/i }));
    expect(onViewResults).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /play again/i }));
    expect(onNewGame).toHaveBeenCalled();
  });
});
