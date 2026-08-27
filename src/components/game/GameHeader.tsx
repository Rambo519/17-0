import styles from "./gameHeader.module.css";

import { PRODUCT_NAME } from "@/lib/brand";
import type { GameMode } from "@/lib/game/types";
import { GameProgress } from "./GameProgress";
import { NewGameButton } from "./NewGameButton";
import { QaControls } from "./QaControls";
import { SoundToggle } from "./SoundToggle";

interface GameHeaderProps {
  mode: GameMode;
  roundNumber: number;
  filledCount: number;
  isComplete: boolean;
  onNewGame?: () => void;
  newGameDisabled?: boolean;
  onQaReroll?: () => void;
  onQaBal2000s?: () => void;
}

export function GameHeader({
  mode,
  roundNumber,
  filledCount,
  isComplete,
  onNewGame,
  newGameDisabled = false,
  onQaReroll,
  onQaBal2000s,
}: GameHeaderProps) {
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
        {onNewGame ? <NewGameButton onClick={onNewGame} disabled={newGameDisabled} /> : null}
        {onQaReroll || onQaBal2000s ? (
          <div className={styles.qa}>
            <QaControls
              onReroll={onQaReroll}
              onBal2000s={onQaBal2000s}
              disabled={newGameDisabled}
            />
          </div>
        ) : null}
        <GameProgress filledCount={filledCount} />
      </div>
    </header>
  );
}
