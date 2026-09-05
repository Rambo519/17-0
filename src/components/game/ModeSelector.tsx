import Image from "next/image";

import { FieldDecor } from "./FieldDecor";
import { NewGameButton } from "./NewGameButton";
import { ShareButton } from "./ShareButton";
import { SoundToggle } from "./SoundToggle";
import styles from "./modeSelector.module.css";

import { copyrightYear, formatReleaseLabel } from "@/lib/appVersion";
import { PRODUCT_NAME } from "@/lib/brand";

export const START_HEADLINE = "TEST YOUR FOOTBALL IQ";
export const START_SUBTITLE =
  "It's 4th and 1. You know the team. You know the era. Can you build 17–0?";
export const START_SUBTITLE_LEAD = "It's 4th and 1. You know the team.";
export const START_SUBTITLE_TAIL = "You know the era. Can you build 17–0?";
export const START_ACTION_LABEL = "PROVE IT";

interface ModeSelectorProps {
  onStart: () => void;
  busy: boolean;
  onNewGame?: () => void;
  appVersion?: string;
}

export function ModeSelector({
  onStart,
  busy,
  onNewGame,
  appVersion,
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
        <ShareButton />
      </div>

      <div className={styles.content}>
        <div className={styles.lockup}>
          <Image
            className={styles.emblem}
            src="/brand/gold-football-17-0-landing.png"
            alt={PRODUCT_NAME}
            width={1200}
            height={719}
            sizes="(min-width: 901px) min(30.2rem, 8.6rem + 20vw), 56vw"
            preload
          />
          <h1 id="start-heading" className={styles.headline}>
            {START_HEADLINE}
          </h1>
        </div>
        <p className={styles.pitch}>
          <span className={styles.pitchLine}>{START_SUBTITLE_LEAD}</span>
          <span className={styles.pitchGap}> </span>
          <span className={styles.pitchLine}>{START_SUBTITLE_TAIL}</span>
        </p>

        <button type="button" className={styles.start} onClick={onStart} disabled={busy}>
          {busy ? "Starting…" : START_ACTION_LABEL}
        </button>

        <details className={styles.how}>
          <summary>How to Play</summary>
          <p>
            Spin a franchise and era, then draft one eligible player. Fill all six pro-set
            spots. One team reroll. One era reroll. Then see if the offense can run the table.
          </p>
        </details>
      </div>

      <footer className={styles.footer}>
        <span>{PRODUCT_NAME}</span>
        <span aria-hidden className={styles.footerSep}>
          ·
        </span>
        <span>
          {formatReleaseLabel()}
          {appVersion ? <span className={styles.footerBuild}> ({appVersion})</span> : null}
        </span>
        <span aria-hidden className={styles.footerSep}>
          ·
        </span>
        <span>© {copyrightYear()}</span>
      </footer>
    </section>
  );
}
