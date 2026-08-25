"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import shell from "./game.module.css";

import { GameClientError, loadGame } from "@/lib/game/clientApi";
import type { GameStateView } from "@/lib/game/view";
import { filledPickCount } from "@/lib/game/uiHelpers";
import { CompletedLineup } from "./CompletedLineup";
import { GameHeader } from "./GameHeader";

interface CompletedGamePageClientProps {
  sessionId: string;
}

export function CompletedGamePageClient({ sessionId }: CompletedGamePageClientProps) {
  const router = useRouter();
  const [game, setGame] = useState<GameStateView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const payload = await loadGame(sessionId);
        if (cancelled) return;
        if (!payload.game) {
          setError("Could not load this game.");
          return;
        }
        if (!payload.game.isComplete) {
          setError("This game is still in progress. Start from the home screen.");
          return;
        }
        setGame(payload.game);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof GameClientError ? err.userMessage : "Could not load this game.";
        setError(message);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (error) {
    return (
      <main className={shell.shell}>
        <p className={shell.errorBanner}>{error}</p>
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
        <p role="status">Loading lineup...</p>
      </main>
    );
  }

  return (
    <main className={shell.shell}>
      <GameHeader
        mode={game.mode}
        roundNumber={game.roundNumber}
        filledCount={filledPickCount(game)}
        isComplete
      />
      <CompletedLineup
        lineup={game.lineup}
        onNewGame={() => router.push("/")}
        onViewResults={() => router.push(`/game/${sessionId}/results`)}
      />
    </main>
  );
}
