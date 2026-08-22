"use client";

import { useState } from "react";

import type { LineupSlot } from "@/lib/football/positions";
import type { SpinResult } from "@/lib/game/spin";
import type { GameMode } from "@/lib/game/types";
import type { GameStateView } from "@/lib/game/view";

interface ApiPayload {
  game?: GameStateView;
  spin?: SpinResult | null;
  error?: { code: string; message: string };
}

const buttonStyle = { padding: "6px 12px", cursor: "pointer" } as const;
const cellStyle = { border: "1px solid #ccc", padding: 8, textAlign: "left" } as const;

export default function DevGamePage() {
  const [mode, setMode] = useState<GameMode>("CLASSIC");
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
      if ("spin" in payload) setSpin(payload.spin ?? null);
      return payload;
    } finally {
      setBusy(false);
    }
  }

  async function startNewGame() {
    setSelectedCardId(null);
    const payload = await call("/api/game/start", { mode });
    if (!payload.error) setSpin(null);
  }

  async function doSpin() {
    if (!game) return;
    setSelectedCardId(null);
    await call("/api/game/spin", { sessionId: game.sessionId });
  }

  async function doTeamSkip() {
    if (!game) return;
    setSelectedCardId(null);
    await call("/api/game/team-skip", { sessionId: game.sessionId });
  }

  async function doEraSkip() {
    if (!game) return;
    setSelectedCardId(null);
    await call("/api/game/era-skip", { sessionId: game.sessionId });
  }

  async function pick(lineupSlot: LineupSlot) {
    if (!game || selectedCardId === null) return;
    const payload = await call("/api/game/pick", {
      sessionId: game.sessionId,
      playerTeamEraCardId: selectedCardId,
      lineupSlot,
    });
    if (!payload.error) {
      setSelectedCardId(null);
    }
  }

  const selected = spin?.candidates.find((candidate) => candidate.card.cardId === selectedCardId);

  return (
    <main style={{ padding: 24, maxWidth: 900 }}>
      <h1>Dev: draft engine harness</h1>
      <p style={{ color: "#666" }}>Phase 3 gameplay harness. Not the final interface.</p>

      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 12 }}>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "CLASSIC"}
            onChange={() => setMode("CLASSIC")}
            disabled={busy}
          />{" "}
          CLASSIC
        </label>
        <label>
          <input
            type="radio"
            name="mode"
            checked={mode === "IQ"}
            onChange={() => setMode("IQ")}
            disabled={busy}
          />{" "}
          IQ
        </label>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <button style={buttonStyle} onClick={startNewGame} disabled={busy}>
          {game ? "Start New Game" : "Start Game"}
        </button>
        <button
          style={buttonStyle}
          onClick={doSpin}
          disabled={busy || !game || game.isComplete || Boolean(spin)}
        >
          Spin
        </button>
        <button
          style={buttonStyle}
          onClick={doTeamSkip}
          disabled={busy || !game || game.isComplete || !spin || game.teamSkipRemaining <= 0}
        >
          Team Skip ({game?.teamSkipRemaining ?? 1})
        </button>
        <button
          style={buttonStyle}
          onClick={doEraSkip}
          disabled={busy || !game || game.isComplete || !spin || game.eraSkipRemaining <= 0}
        >
          Era Skip ({game?.eraSkipRemaining ?? 1})
        </button>
      </div>

      {error && <p style={{ color: "#b00020" }}>{error}</p>}

      {!game && <p>No game yet.</p>}

      {game && (
        <>
          <p>
            Session <code>{game.sessionId}</code> — mode <strong>{game.mode}</strong> — status{" "}
            <strong>{game.status}</strong> — round {game.roundNumber} of 6 — Team Skip{" "}
            {game.teamSkipRemaining} — Era Skip {game.eraSkipRemaining}
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
          {!spin && <p>{game.isComplete ? "Game COMPLETE." : "No active spin — press Spin."}</p>}

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
