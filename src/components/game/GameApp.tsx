"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import shell from "./game.module.css";

import { playDraftLockSound, playSpinStartSound } from "@/lib/audio/cues";
import { playGameSound, unlockGameAudio } from "@/lib/audio/soundEngine";
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
import {
  prefersReducedMotion,
  runSpinReveal,
  wait,
  type SpinRevealFrame,
  type SpinRevealKind,
} from "@/lib/game/spinReveal";
import type { GameStateView } from "@/lib/game/view";
import { confirmNewGameIfNeeded } from "@/lib/game/newGame";
import { filledPickCount, highlightedSlotsForCandidate } from "@/lib/game/uiHelpers";
import { CompletedLineup } from "./CompletedLineup";
import { FormationField } from "./FormationField";
import { GameHeader } from "./GameHeader";
import { ModeSelector } from "./ModeSelector";
import { SpinPanel } from "./SpinPanel";

type Screen = "mode" | "playing" | "complete";
type MobileTab = "players" | "lineup";
type BusyAction = "start" | "spin" | "pick" | "team-skip" | "era-skip" | null;

export function GameApp() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screen>("mode");
  const [game, setGame] = useState<GameStateView | null>(null);
  const [spin, setSpin] = useState<SpinResult | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [reveal, setReveal] = useState<SpinRevealFrame | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>("players");
  const cancelledRef = useRef(false);
  const spinInFlight = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
    };
  }, []);

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
    setReveal(null);
    setSpinning(false);
    setMobileTab("players");
  }

  async function beginFreshGame(nextMode: GameMode) {
    unlockGameAudio();
    setBusy("start");
    setError(null);
    try {
      const payload = await startGame(nextMode);
      if (!payload.game) throw new GameClientError("INTERNAL_ERROR", "Missing game state.");
      setGame(payload.game);
      setSpin(null);
      setReveal(null);
      setSelectedCardId(null);
      setSpinning(false);
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

  async function handleStart() {
    await beginFreshGame("IQ");
  }

  async function handleNewGame() {
    if (busy !== null) return;
    const filledCount = game ? filledPickCount(game) : 0;
    if (!confirmNewGameIfNeeded(filledCount)) return;
    resetToMode();
  }

  async function animateSpin(
    kind: SpinRevealKind,
    pending: Promise<SpinResult>,
    held?: { abbreviation: string; franchiseName: string; eraLabel: string },
  ): Promise<SpinResult> {
    setSpinning(true);
    setSelectedCardId(null);
    let teamLockPlayed = false;
    let eraLockPlayed = false;
    try {
      const result = await runSpinReveal(
        kind,
        pending,
        {
          wait,
          now: () => performance.now(),
          rng: Math.random,
          onFrame: setReveal,
          onTeamLock: () => {
            if (teamLockPlayed) return;
            teamLockPlayed = true;
            playGameSound(kind === "full" ? "TEAM_REVEAL" : "SKIP");
          },
          onEraLock: () => {
            if (eraLockPlayed) return;
            eraLockPlayed = true;
            playGameSound(kind === "full" ? "ERA_REVEAL" : "SKIP");
          },
          isCancelled: () => cancelledRef.current,
        },
        { reducedMotion: prefersReducedMotion(), held },
      );
      setSpin(result);
      return result;
    } finally {
      setSpinning(false);
    }
  }

  async function handleSpin() {
    if (!game || spinInFlight.current || busy !== null) return;
    unlockGameAudio();
    spinInFlight.current = true;
    setBusy("spin");
    setError(null);
    setMobileTab("players");
    playSpinStartSound();
    try {
      const pending = spinGame(game.sessionId).then((payload) => {
        if (payload.game) setGame(payload.game);
        if (!payload.spin) throw new GameClientError("INTERNAL_ERROR", "Spin returned no result.");
        return payload.spin;
      });
      await animateSpin("full", pending);
    } catch (err) {
      setReveal(null);
      const message = err instanceof GameClientError ? err.userMessage : "Spin failed.";
      setError(message);
      console.error(err);
    } finally {
      spinInFlight.current = false;
      setBusy(null);
    }
  }

  async function handleTeamSkip() {
    if (!game || !spin || spinInFlight.current || busy !== null) return;
    unlockGameAudio();
    spinInFlight.current = true;
    setBusy("team-skip");
    setError(null);
    try {
      const held = {
        abbreviation: spin.franchise.abbreviation,
        franchiseName: spin.franchise.name,
        eraLabel: spin.era.label,
      };
      const pending = teamSkip(game.sessionId).then((payload) => {
        if (payload.game) setGame(payload.game);
        if (!payload.spin) throw new GameClientError("INTERNAL_ERROR", "Team skip returned no result.");
        return payload.spin;
      });
      await animateSpin("team", pending, held);
    } catch (err) {
      setReveal(null);
      const message =
        err instanceof GameClientError ? err.userMessage : "Team Skip could not be used.";
      setError(message);
      console.error(err);
    } finally {
      spinInFlight.current = false;
      setBusy(null);
    }
  }

  async function handleEraSkip() {
    if (!game || !spin || spinInFlight.current || busy !== null) return;
    unlockGameAudio();
    spinInFlight.current = true;
    setBusy("era-skip");
    setError(null);
    try {
      const held = {
        abbreviation: spin.franchise.abbreviation,
        franchiseName: spin.franchise.name,
        eraLabel: spin.era.label,
      };
      const pending = eraSkip(game.sessionId).then((payload) => {
        if (payload.game) setGame(payload.game);
        if (!payload.spin) throw new GameClientError("INTERNAL_ERROR", "Era skip returned no result.");
        return payload.spin;
      });
      await animateSpin("era", pending, held);
    } catch (err) {
      setReveal(null);
      const message =
        err instanceof GameClientError ? err.userMessage : "Era Skip could not be used.";
      setError(message);
      console.error(err);
    } finally {
      spinInFlight.current = false;
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
      playDraftLockSound();
      setSpin(null);
      setReveal(null);
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
      <main className={`${shell.shell} ${shell.landing}`}>
        {error ? <p className={shell.errorBanner}>{error}</p> : null}
        <ModeSelector
          onStart={handleStart}
          onNewGame={() => {
            void handleNewGame();
          }}
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
          onNewGame={() => {
            void handleNewGame();
          }}
          newGameDisabled={busy !== null}
        />
        {error ? <p className={shell.errorBanner}>{error}</p> : null}
        <CompletedLineup
          lineup={game.lineup}
          onNewGame={resetToMode}
          onViewResults={() => {
            unlockGameAudio();
            router.push(`/game/${game.sessionId}/results`);
          }}
        />
      </main>
    );
  }

  const boardClass =
    mobileTab === "players"
      ? `${shell.board} ${shell.hideOnMobileLineup}`
      : `${shell.board} ${shell.hideOnMobilePlayers}`;

  return (
    <main className={`${shell.shell} ${shell.playing}`}>
      <GameHeader
        mode={game.mode}
        roundNumber={game.roundNumber}
        filledCount={filledPickCount(game)}
        isComplete={false}
        onNewGame={() => {
          void handleNewGame();
        }}
        newGameDisabled={busy !== null}
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
            reveal={reveal}
            selectedCardId={selectedCardId}
            teamSkipRemaining={game.teamSkipRemaining}
            eraSkipRemaining={game.eraSkipRemaining}
            busy={busy !== null}
            spinning={spinning}
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
