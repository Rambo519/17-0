import { FieldDecor } from "./FieldDecor";
import { NewGameButton } from "./NewGameButton";
import { QaControls } from "./QaControls";
import { SoundToggle } from "./SoundToggle";
import styles from "./modeSelector.module.css";

import { PRODUCT_NAME } from "@/lib/brand";

export const START_HEADLINE = "TEST YOUR FOOTBALL IQ";
export const START_SUBTITLE = "You know the team. You know the era. Can you build 17–0?";
export const START_ACTION_LABEL = "PROVE IT";

interface ModeSelectorProps {
  onStart: () => void;
  busy: boolean;
  onNewGame?: () => void;
  onQaReroll?: () => void;
  onQaBal2000s?: () => void;
}

export function ModeSelector({
  onStart,
  busy,
  onNewGame,
  onQaReroll,
  onQaBal2000s,
}: ModeSelectorProps) {
  return (
    <section className={styles.root} aria-labelledby="start-heading">
      <div className={styles.atmosphere} aria-hidden>
        <FieldDecor variant="start" />
        <div className={styles.glow} />
        <div className={styles.sweep} />
        <div className={styles.grain} />
        <p className={styles.watermark}>{PRODUCT_NAME}</p>
      </div>

      <div className={styles.topBar}>
        <SoundToggle />
        {onNewGame ? <NewGameButton onClick={onNewGame} disabled={busy} /> : null}
        <QaControls onReroll={onQaReroll} onBal2000s={onQaBal2000s} disabled={busy} />
      </div>

      <div className={styles.content}>
        <p className={styles.brand}>{PRODUCT_NAME}</p>
        <h1 id="start-heading" className={styles.headline}>
          {START_HEADLINE}
        </h1>
        <p className={styles.pitch}>{START_SUBTITLE}</p>

        <button type="button" className={styles.start} onClick={onStart} disabled={busy}>
          {busy ? "Starting…" : START_ACTION_LABEL}
        </button>

        <details className={styles.how}>
          <summary>How to Play</summary>
          <p>
            Spin a franchise and era, then draft one eligible player. Fill all six I-formation
            spots. One team reroll. One era reroll. Then see if the offense can run the table.
          </p>
        </details>
      </div>
    </section>
  );
}
