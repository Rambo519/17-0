"use client";

import { useState } from "react";

import type { LineupSlot } from "@/lib/football/positions";
import type { SpinResult } from "@/lib/game/spin";
import type { GameStateView } from "@/lib/game/view";

interface ApiPayload {
  game?: GameStateView;
  spin?: SpinResult | null;
  error?: { code: string; message: string };
}

const buttonStyle = { padding: "6px 12px", cursor: "pointer" } as const;
const cellStyle = { border: "1px solid #ccc", padding: 8, textAlign: "left" } as const;

export default function DevGamePage() {
  const [game, setGame] = useState<GameStateView | null>(null);
  const [spin, setSpin] = useState<SpinResult | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      const payload = (await response.json()) as ApiPayload;

      if (!response.ok) {
        setError(`${payload.error?.code ?? response.status}: ${payload.error?.message ?? "Request failed"}`);
        return payload;
      }

      if (payload.game) setGame(payload.game);
      return payload;
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    setSpin(null);
    setSelectedCardId(null);
    await call("/api/game/start");
  }

  async function doSpin() {
    if (!game) return;
    setSelectedCardId(null);
    const payload = await call("/api/game/spin", { sessionId: game.sessionId });
    setSpin(payload.spin ?? null);
  }

  async function pick(lineupSlot: LineupSlot) {
    if (!game || selectedCardId === null) return;
    const payload = await call("/api/game/pick", {
      sessionId: game.sessionId,
      playerTeamEraCardId: selectedCardId,
      lineupSlot,
    });
    if (!payload.error) {
      setSpin(null);
      setSelectedCardId(null);
    }
  }

  const selected = spin?.candidates.find((candidate) => candidate.card.cardId === selectedCardId);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Dev: draft engine harness</h1>
      <p style={{ color: "#666" }}>Development data only. Not the final interface.</p>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button style={buttonStyle} onClick={startGame} disabled={busy}>
          Start Game
        </button>
        <button
          style={buttonStyle}
          onClick={doSpin}
          disabled={busy || !game || game.isComplete || Boolean(spin)}
        >
          Spin
        </button>
      </div>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {!game && <p>No game yet.</p>}

      {game && (
        <>
          <p>
            Session <code>{game.sessionId}</code> — status <strong>{game.status}</strong> — round{" "}
            {Math.min(game.nextRoundNumber, 6)} of 6
          </p>

          <h2>Lineup</h2>
          <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 24 }}>
            <thead>
              <tr>
                <th style={cellStyle}>Slot</th>
                <th style={cellStyle}>Accepts</th>
                <th style={cellStyle}>State</th>
                <th style={cellStyle}>Player</th>
                <th style={cellStyle}>Assign</th>
              </tr>
            </thead>
            <tbody>
              {game.lineup.map((slot) => {
                const assignable =
                  selected !== undefined && selected.eligibleSlots.includes(slot.slot) && !slot.filled;
                return (
                  <tr key={slot.slot}>
                    <td style={cellStyle}>
                      <strong>{slot.slot}</strong>
                    </td>
                    <td style={cellStyle}>{slot.accepts}</td>
                    <td style={cellStyle}>{slot.filled ? "LOCKED" : "empty"}</td>
                    <td style={cellStyle}>
                      {slot.player
                        ? `${slot.player.playerName} — ${slot.player.franchiseName} (${slot.player.eraLabel})`
                        : "—"}
                    </td>
                    <td style={cellStyle}>
                      <button
                        style={buttonStyle}
                        disabled={busy || !assignable}
                        onClick={() => pick(slot.slot)}
                      >
                        Assign here
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h2>Current spin</h2>
          {!spin && <p>{game.isComplete ? "Game complete." : "No active spin."}</p>}

          {spin && (
            <>
              <p>
                Franchise <strong>{spin.franchise.name}</strong> — decade{" "}
                <strong>{spin.era.label}</strong> — open slots {spin.openSlots.join(", ")}
              </p>
              <ul style={{ listStyle: "none", padding: 0 }}>
                {spin.candidates.map(({ card, eligibleSlots }) => (
                  <li key={card.cardId} style={{ marginBottom: 4 }}>
                    <label style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="candidate"
                        checked={selectedCardId === card.cardId}
                        onChange={() => setSelectedCardId(card.cardId)}
                      />{" "}
                      {card.playerName} — {card.positions.join("/")} — {card.firstSeason}–
                      {card.lastSeason} — fits {eligibleSlots.join(", ")}
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </main>
  );
}
