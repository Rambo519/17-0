"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";

import { prefersReducedMotion } from "@/lib/game/spinReveal";

import styles from "./perfectSeasonConfetti.module.css";

const DURATION_MS = 2600;
const PIECE_COUNT = 42;

const COLORS = [
  "var(--highlight)",
  "#f4e4b0",
  "#ffffff",
  "var(--accent)",
  "var(--text)",
  "#d4a84a",
] as const;

interface Piece {
  id: number;
  color: string;
  width: number;
  height: number;
  dx: string;
  rot: string;
  delay: string;
  duration: string;
}

function buildPieces(): Piece[] {
  const pieces: Piece[] = [];
  for (let index = 0; index < PIECE_COUNT; index += 1) {
    const fan = (index / (PIECE_COUNT - 1) - 0.5) * 92;
    const jitter = ((index * 17) % 13) - 6;
    pieces.push({
      id: index,
      color: COLORS[index % COLORS.length]!,
      width: 5 + (index % 3),
      height: 8 + (index % 4),
      dx: `${(fan + jitter).toFixed(2)}vw`,
      rot: `${(index % 2 === 0 ? 1 : -1) * (220 + (index % 9) * 28)}deg`,
      delay: `${((index % 8) * 28).toFixed(0)}ms`,
      duration: `${(2100 + (index % 6) * 90).toFixed(0)}ms`,
    });
  }
  return pieces;
}

export function PerfectSeasonConfetti() {
  const [visible, setVisible] = useState(false);
  const pieces = useMemo(() => buildPieces(), []);

  useEffect(() => {
    if (prefersReducedMotion()) return undefined;

    const startId = window.setTimeout(() => setVisible(true), 0);
    const endId = window.setTimeout(() => setVisible(false), DURATION_MS);
    return () => {
      window.clearTimeout(startId);
      window.clearTimeout(endId);
    };
  }, []);

  if (!visible || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} data-testid="perfect-season-confetti" aria-hidden="true">
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={styles.piece}
          style={
            {
              "--c": piece.color,
              "--w": `${piece.width}px`,
              "--h": `${piece.height}px`,
              "--dx": piece.dx,
              "--rot": piece.rot,
              "--delay": piece.delay,
              "--dur": piece.duration,
            } as CSSProperties
          }
        />
      ))}
    </div>,
    document.body,
  );
}
