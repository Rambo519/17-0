"use client";

import styles from "./soundToggle.module.css";

interface NewGameButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function NewGameButton({ onClick, disabled = false }: NewGameButtonProps) {
  return (
    <button
      type="button"
      className={styles.off}
      aria-label="New game"
      disabled={disabled}
      onClick={onClick}
    >
      <span className={styles.label}>New game</span>
    </button>
  );
}
