"use client";

import { useEffect, useRef, useState } from "react";

import { shareAppInvite } from "@/lib/share/appShare";

import styles from "./soundToggle.module.css";

const COPIED_MS = 2000;

export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>(0);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
    };
  }, []);

  return (
    <button
      type="button"
      className={styles.off}
      aria-label={copied ? "Link copied" : "Share"}
      onClick={() => {
        void (async () => {
          try {
            const result = await shareAppInvite();
            if (result !== "copied") return;
            setCopied(true);
            if (copiedTimer.current) window.clearTimeout(copiedTimer.current);
            copiedTimer.current = window.setTimeout(() => setCopied(false), COPIED_MS);
          } catch {
            setCopied(false);
          }
        })();
      }}
    >
      <span className={styles.label}>{copied ? "Copied" : "Share"}</span>
    </button>
  );
}
