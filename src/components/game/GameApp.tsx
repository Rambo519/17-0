"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import shell from "./game.module.css";

import {
  eraSkip,
  GameClientError,
  pickPlayer,
  spinGame,
  startGame,
  teamSkip,
} from "@/lib/game/clientApi";
import type { LineupSlot } from "@/lib/football/positions";
import type { GameMode } from "@/lib/game/types";
import type { SpinResult } from "@/lib/game/spin";
import type { GameStateView } from "@/lib/game/view";
import { filledPickCount, highlightedSlotsForCandidate } from "@/lib/game/uiHelpers";
import { CompletedLineup } from "./CompletedLineup";
import { FormationField } from "./FormationField";
import { GameHeader } from "./GameHeader";
import { ModeSelector } from "./ModeSelector";
import { SpinPanel } from "./SpinPanel";

type Screen = "mode" | "playing" | "complete";
type MobileTab = "players" | "lineup";
type BusyAction = "start" | "spin" | "pick" | "team-skip" | "era-skip" | null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function GameApp() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("mode");
  const [modeChoice, setModeChoice] = useState<GameMode>("CLASSIC");
  const [game, setGame] = useState<GameStateView | null>(null);
  const [spin, setSpin] = useState<SpinResult | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [revealing, setRevealing] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("players");

  const selected = useMemo(
    () => spin?.candidates.find((candidate) => candidate.card.cardId === selectedCardId) ?? null,
    [spin, selectedCardId],
  );

  const highlightedSlots = useMemo(
    () => highlightedSlotsForCandidate(selected, game?.openSlots ?? []),
    [selected, game?.openSlots],
  );

  function resetToMode() {
    setScreen("mode");
    setGame(null);
    setSpin(null);
    setSelectedCardId(null);
    setError(null);
    setBusy(null);
    setRevealing(false);
    setMobileTab("players");
  }

  async function handleStart() {
    setBusy("start");
    setError(null);
    try {
      const payload = await startGame(modeChoice);
      if (!payload.game) throw new GameClientError("INTERNAL_ERROR", "Missing game state.");
      setGame(payload.game);
      setSpin(null);
      setSelectedCardId(null);
      setScreen(payload.game.isComplete ? "complete" : "playing");
      setMobileTab("players");
    } catch (err) {
      const message = err instanceof GameClientError ? err.userMessage : "Could not start the game.";
      setError(message);
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function applySpinPayload(payload: { game?: GameStateView; spin?: SpinResult | null }) {
    if (payload.game) setGame(payload.game);
    if ("spin" in payload) {
      setSpin(payload.spin ?? null);
      setSelectedCardId(null);
      if (payload.spin) {
        setRevealing(true);
        await sleep(650);
        setRevealing(false);
      }
    }
    if (payload.game?.isComplete) setScreen("complete");
  }

  async function handleSpin() {
    if (!game) return;
    setBusy("spin");
    setError(null);
    try {
      const payload = await spinGame(game.sessionId);
      await applySpinPayload(payload);
      setMobileTab("players");
    } catch (err) {
      const message = err instanceof GameClientError ? err.userMessage : "Spin failed.";
      setError(message);
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function handleTeamSkip() {
    if (!game) return;
    setBusy("team-skip");
    setError(null);
    try {
      const payload = await teamSkip(game.sessionId);
      await applySpinPayload(payload);
    } catch (err) {
      const message =
        err instanceof GameClientError ? err.userMessage : "Team Skip could not be used.";
      setError(message);
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function handleEraSkip() {
    if (!game) return;
    setBusy("era-skip");
    setError(null);
    try {
      const payload = await eraSkip(game.sessionId);
      await applySpinPayload(payload);
    } catch (err) {
      const message =
        err instanceof GameClientError ? err.userMessage : "Era Skip could not be used.";
      setError(message);
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  async function handleSelectSlot(slot: LineupSlot) {
    if (!game || selectedCardId === null) return;
    if (!highlightedSlots.includes(slot)) return;

    setBusy("pick");
    setError(null);
    try {
      const payload = await pickPlayer(game.sessionId, selectedCardId, slot);
      if (payload.game) setGame(payload.game);
      setSpin(null);
      setSelectedCardId(null);
      if (payload.game?.isComplete) {
        setScreen("complete");
      } else {
        setMobileTab("players");
      }
    } catch (err) {
      const message = err instanceof GameClientError ? err.userMessage : "Draft failed.";
      setError(message);
      console.error(err);
    } finally {
      setBusy(null);
    }
  }

  if (screen === "mode") {
    return (
      <main className={shell.shell}>
        {error ? <p className={shell.errorBanner}>{error}</p> : null}
        <ModeSelector
          mode={modeChoice}
          onModeChange={setModeChoice}
          onStart={handleStart}
          busy={busy === "start"}
        />
      </main>
    );
  }

  if (!game) return null;

  if (screen === "complete") {
    return (
      <main className={shell.shell}>
        <GameHeader
          mode={game.mode}
          roundNumber={game.roundNumber}
          filledCount={filledPickCount(game)}
          isComplete
        />
        {error ? <p className={shell.errorBanner}>{error}</p> : null}
        <CompletedLineup
          lineup={game.lineup}
          onNewGame={resetToMode}
          onViewResults={() => router.push(`/game/${game.sessionId}/results`)}
        />
      </main>
    );
  }

  const boardClass =
    mobileTab === "players"
      ? `${shell.board} ${shell.hideOnMobileLineup}`
      : `${shell.board} ${shell.hideOnMobilePlayers}`;

  return (
    <main className={shell.shell}>
      <GameHeader
        mode={game.mode}
        roundNumber={game.roundNumber}
        filledCount={filledPickCount(game)}
        isComplete={false}
      />

      <div className={shell.mobileTabs} role="tablist" aria-label="Game panels">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "players"}
          className={mobileTab === "players" ? shell.mobileTabActive : shell.mobileTab}
          onClick={() => setMobileTab("players")}
        >
          Players
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "lineup"}
          className={mobileTab === "lineup" ? shell.mobileTabActive : shell.mobileTab}
          onClick={() => setMobileTab("lineup")}
        >
          Lineup
        </button>
      </div>

      {error ? <p className={shell.errorBanner}>{error}</p> : null}

      <div className={boardClass}>
        <div className={shell.leftColumn}>
          <SpinPanel
            mode={game.mode}
            spin={spin}
            selectedCardId={selectedCardId}
            teamSkipRemaining={game.teamSkipRemaining}
            eraSkipRemaining={game.eraSkipRemaining}
            busy={busy !== null}
            revealing={revealing}
            isComplete={false}
            onSpin={handleSpin}
            onTeamSkip={handleTeamSkip}
            onEraSkip={handleEraSkip}
            onSelectCandidate={(cardId) => {
              setSelectedCardId(cardId);
              setMobileTab("lineup");
            }}
          />
        </div>
        <div className={shell.rightColumn}>
          <FormationField
            lineup={game.lineup}
            highlightedSlots={highlightedSlots}
            onSelectSlot={(slot) => {
              void handleSelectSlot(slot);
            }}
          />
        </div>
      </div>
    </main>
  );
}
