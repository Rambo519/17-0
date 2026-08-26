import styles from "./gameHeader.module.css";

import { PRODUCT_NAME } from "@/lib/brand";
import type { GameMode } from "@/lib/game/types";
import { SoundToggle } from "./SoundToggle";
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
        <p className={styles.brand}>{PRODUCT_NAME}</p>
        <p className={styles.meta}>
          {isComplete ? "Offense complete" : `Round ${roundNumber} of 6`}
          <span className={styles.dot} aria-hidden>
            ·
          </span>
          <span className={styles.mode}>{mode}</span>
        </p>
      </div>
      <div className={styles.right}>
        <SoundToggle />
        <GameProgress filledCount={filledCount} />
      </div>
    </header>
  );
}
