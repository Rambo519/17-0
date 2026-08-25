"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import shell from "./game.module.css";

import { GameClientError, loadGame, loadGameScore } from "@/lib/game/clientApi";
import type { GameStateView } from "@/lib/game/view";
import type { ScoringResultView } from "@/lib/scoring/view";
import { GameHeader } from "./GameHeader";
import { ResultsView } from "./ResultsView";

interface ResultsPageClientProps {
  sessionId: string;
}

export function ResultsPageClient({ sessionId }: ResultsPageClientProps) {
  const router = useRouter();
  const [game, setGame] = useState<GameStateView | null>(null);
  const [score, setScore] = useState<ScoringResultView | null>(null);
  const [scoreStatus, setScoreStatus] = useState<"loading" | "error" | "ready">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [scoreBusy, setScoreBusy] = useState(false);
  const inFlight = useRef(false);

  const fetchScore = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setScoreBusy(true);
    setScoreStatus("loading");
    setErrorMessage(null);
    try {
      const result = await loadGameScore(sessionId);
      setScore(result);
      setScoreStatus("ready");
    } catch (err) {
      const message =
        err instanceof GameClientError ? err.userMessage : "Could not calculate this season.";
      setErrorMessage(message);
      setScoreStatus("error");
    } finally {
      inFlight.current = false;
      setScoreBusy(false);
    }
  }, [sessionId]);

  useEffect(() => {
    let cancelled = false;
    inFlight.current = false;

    async function load() {
      setPageError(null);
      setScoreStatus("loading");
      try {
        const payload = await loadGame(sessionId);
        if (cancelled) return;
        if (!payload.game?.isComplete) {
          setPageError("This game is not complete yet.");
          setGame(payload.game ?? null);
          return;
        }
        setGame(payload.game);
        await fetchScore();
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof GameClientError ? err.userMessage : "Could not load this game.";
        setPageError(message);
      }
    }

    void load();
    return () => {
      cancelled = true;
      inFlight.current = false;
    };
  }, [sessionId, fetchScore]);

  if (pageError && !game?.isComplete) {
    return (
      <main className={shell.shell}>
        <p className={shell.errorBanner}>{pageError}</p>
        <div>
          <button type="button" className={shell.btnPrimary} onClick={() => router.push("/")}>
            Play Again
          </button>
        </div>
      </main>
    );
  }

  if (!game) {
    return (
      <main className={shell.shell}>
        <p className={shell.errorBanner} role="status">
          Loading lineup...
        </p>
      </main>
    );
  }

  return (
    <main className={shell.shell}>
      <GameHeader mode={game.mode} roundNumber={game.roundNumber} filledCount={6} isComplete />
      <ResultsView
        game={game}
        score={score}
        scoreStatus={game.isComplete ? scoreStatus : "error"}
        errorMessage={errorMessage ?? pageError}
        onRetry={() => {
          void fetchScore();
        }}
        onPlayAgain={() => router.push("/")}
        onBackToLineup={() => router.push(`/game/${sessionId}`)}
        retryDisabled={scoreBusy}
      />
    </main>
  );
}
