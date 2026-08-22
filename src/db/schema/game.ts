import { index, integer, pgTable, serial, timestamp, unique, uuid } from "drizzle-orm/pg-core";

import { playerTeamEraCards } from "./cards";
import { gameModeEnum, gameStatusEnum, lineupSlotEnum } from "./enums";
import { eras } from "./eras";
import { franchises } from "./franchises";
import { players } from "./players";

/**
 * `current_franchise_id` / `current_era_id` hold the outstanding spin. They are
 * set by a spin and cleared once the resulting pick is made.
 */
export const gameSessions = pgTable("game_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  status: gameStatusEnum("status").notNull().default("ACTIVE"),
  mode: gameModeEnum("mode").notNull().default("CLASSIC"),
  teamSkipRemaining: integer("team_skip_remaining").notNull().default(1),
  eraSkipRemaining: integer("era_skip_remaining").notNull().default(1),
  currentFranchiseId: integer("current_franchise_id").references(() => franchises.id, {
    onDelete: "set null",
  }),
  currentEraId: integer("current_era_id").references(() => eras.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

/** A completed session holds exactly six picks, one per lineup slot. */
export const gamePicks = pgTable(
  "game_picks",
  {
    id: serial("id").primaryKey(),
    gameSessionId: uuid("game_session_id")
      .notNull()
      .references(() => gameSessions.id, { onDelete: "cascade" }),
    roundNumber: integer("round_number").notNull(),
    lineupSlot: lineupSlotEnum("lineup_slot").notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "restrict" }),
    playerTeamEraCardId: integer("player_team_era_card_id")
      .notNull()
      .references(() => playerTeamEraCards.id, { onDelete: "restrict" }),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "restrict" }),
    eraId: integer("era_id")
      .notNull()
      .references(() => eras.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("game_picks_session_slot_unique").on(table.gameSessionId, table.lineupSlot),
    unique("game_picks_session_player_unique").on(table.gameSessionId, table.playerId),
    unique("game_picks_session_round_unique").on(table.gameSessionId, table.roundNumber),
    index("game_picks_session_idx").on(table.gameSessionId),
  ],
);

export type GameSessionRow = typeof gameSessions.$inferSelect;
export type NewGameSessionRow = typeof gameSessions.$inferInsert;
export type GamePickRow = typeof gamePicks.$inferSelect;
export type NewGamePickRow = typeof gamePicks.$inferInsert;
