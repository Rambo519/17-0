"use client";

import type { KeyboardEvent } from "react";

import styles from "./modeSelector.module.css";

import { PRODUCT_NAME } from "@/lib/brand";
import type { GameMode } from "@/lib/game/types";
import { SoundToggle } from "./SoundToggle";

interface ModeSelectorProps {
  mode: GameMode;
  onModeChange: (mode: GameMode) => void;
  onStart: () => void;
  busy: boolean;
}

export function ModeSelector({ mode, onModeChange, onStart, busy }: ModeSelectorProps) {
  function handleModeKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      onModeChange("IQ");
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      onModeChange("CLASSIC");
    }
  }

  return (
    <section className={styles.root} aria-labelledby="mode-heading">
      <div className={styles.atmosphere} aria-hidden>
        <div className={styles.field} />
        <div className={styles.glow} />
        <div className={styles.sweep} />
        <div className={styles.grain} />
        <p className={styles.watermark}>{PRODUCT_NAME}</p>
      </div>

      <div className={styles.topBar}>
        <SoundToggle />
      </div>

      <div className={styles.content}>
        <p className={styles.brand}>{PRODUCT_NAME}</p>
        <h1 id="mode-heading" className={styles.headline}>
          Build the Perfect Offense
        </h1>
        <p className={styles.pitch}>
          Six picks.
          <br />
          Six eras of NFL history.
          <br />
          One shot at perfection.
        </p>

        <div
          className={styles.modes}
          role="radiogroup"
          aria-label="Game mode"
          onKeyDown={handleModeKeyDown}
        >
          <button
            type="button"
            role="radio"
            aria-checked={mode === "CLASSIC"}
            className={mode === "CLASSIC" ? styles.modeActive : styles.mode}
            onClick={() => onModeChange("CLASSIC")}
            disabled={busy}
          >
            <span className={styles.modeTitle}>Classic</span>
            <span className={styles.modeCopy}>See historical production while you draft.</span>
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
            <span className={styles.modeCopy}>No statistical help. Trust your football knowledge.</span>
          </button>
        </div>

        <button type="button" className={styles.start} onClick={onStart} disabled={busy}>
          {busy ? "Starting…" : "Start Game"}
        </button>

        <details className={styles.how}>
          <summary>How to play</summary>
          <p>
            Spin a franchise and era, then draft one eligible player. Fill all six I-formation
            spots. One team reroll. One era reroll. Then see if the offense can run the table.
          </p>
        </details>
      </div>
    </section>
  );
}
