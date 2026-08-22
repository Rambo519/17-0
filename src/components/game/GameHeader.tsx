import styles from "./gameHeader.module.css";

import type { GameMode } from "@/lib/game/types";
import { GameProgress } from "./GameProgress";

interface GameHeaderProps {
  mode: GameMode;
  roundNumber: number;
  filledCount: number;
  isComplete: boolean;
}

export function GameHeader({ mode, roundNumber, filledCount, isComplete }: GameHeaderProps) {
  return (
    <header className={styles.root}>
      <div className={styles.left}>
        <p className={styles.brand}>16&amp;0</p>
        <p className={styles.meta}>
          {isComplete ? "Offense complete" : `Round ${roundNumber} of 6`}
          <span className={styles.dot} aria-hidden>
            ·
          </span>
          <span className={styles.mode}>{mode}</span>
        </p>
      </div>
      <GameProgress filledCount={filledCount} />
    </header>
  );
}
