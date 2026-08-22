import styles from "./modeSelector.module.css";

import type { GameMode } from "@/lib/game/types";

interface ModeSelectorProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  onStart: () => void;
  busy: boolean;
}

export function ModeSelector({ mode, onModeChange, onStart, busy }: ModeSelectorProps) {
  return (
    <section className={styles.root} aria-labelledby="mode-heading">
      <p className={styles.brand}>16&amp;0</p>
      <h1 id="mode-heading" className={styles.headline}>
        Build the Perfect Offense
      </h1>
      <p className={styles.sub}>
        Draft six historical players through franchise and era spins. One Team Skip. One Era Skip.
      </p>

      <div className={styles.modes} role="radiogroup" aria-label="Game mode">
        <button
          type="button"
          role="radio"
          aria-checked={mode === "CLASSIC"}
          className={mode === "CLASSIC" ? styles.modeActive : styles.mode}
          onClick={() => onModeChange("CLASSIC")}
          disabled={busy}
        >
          <span className={styles.modeTitle}>Classic</span>
          <span className={styles.modeCopy}>See historical production while drafting.</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={mode === "IQ"}
          className={mode === "IQ" ? styles.modeActive : styles.mode}
          onClick={() => onModeChange("IQ")}
          disabled={busy}
        >
          <span className={styles.modeTitle}>IQ</span>
          <span className={styles.modeCopy}>
            Trust your football knowledge. Detailed stats stay hidden.
          </span>
        </button>
      </div>

      <button type="button" className={styles.start} onClick={onStart} disabled={busy}>
        {busy ? "Starting…" : "Start Game"}
      </button>
    </section>
  );
}
