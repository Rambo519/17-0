"use client";

import styles from "./soundToggle.module.css";

import { isDevelopmentQaEnabled } from "@/lib/game/qaAccess";

interface QaControlsProps {
  onReroll?: () => void;
  onBal2000s?: () => void;
  disabled?: boolean;
}

export function QaControls({ onReroll, onBal2000s, disabled = false }: QaControlsProps) {
  if (process.env.NODE_ENV === "production") return null;
  if (!isDevelopmentQaEnabled()) return null;
  if (!onReroll && !onBal2000s) return null;

  return (
    <div className={styles.group} role="group" aria-label="Development QA">
      {onReroll ? (
        <button
          type="button"
          className={styles.off}
          aria-label="QA reroll"
          disabled={disabled}
          onClick={onReroll}
        >
          <span className={styles.label}>Reroll</span>
        </button>
      ) : null}
      {onBal2000s ? (
        <button
          type="button"
          className={styles.off}
          aria-label="QA BAL 2000s"
          disabled={disabled}
          onClick={onBal2000s}
        >
          <span className={styles.label}>BAL 2000s</span>
        </button>
      ) : null}
    </div>
  );
}
