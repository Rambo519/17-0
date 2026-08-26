"use client";

import styles from "./soundToggle.module.css";

import { useGameAudio } from "@/lib/audio/useGameAudio";

export function SoundToggle() {
  const { enabled, setEnabled, unlock } = useGameAudio();

  return (
    <button
      type="button"
      className={enabled ? styles.on : styles.off}
      aria-pressed={enabled}
      aria-label={enabled ? "Sound on" : "Sound off"}
      onClick={() => {
        unlock();
        setEnabled(!enabled);
      }}
    >
      <span aria-hidden className={styles.icon}>
        {enabled ? "🔊" : "🔇"}
      </span>
      <span className={styles.label}>{enabled ? "Sound on" : "Sound off"}</span>
    </button>
  );
}
