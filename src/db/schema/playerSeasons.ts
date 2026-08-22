import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { normalizedPositionEnum } from "./enums";
import { franchises } from "./franchises";
import { players } from "./players";

/**
 * One player's membership and production with one franchise in one season.
 *
 * Every statistic is nullable on purpose: for historical seasons "not
 * recorded" and "zero" are different facts and must stay distinguishable.
 */
export const playerSeasons = pgTable(
  "player_seasons",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),

    /** Unmodified label from the source data, e.g. "HB", "FL", "H-BACK". */
    rawPosition: text("raw_position").notNull(),
    primaryNormalizedPosition: normalizedPositionEnum("primary_normalized_position").notNull(),

    games: integer("games"),
    gamesStarted: integer("games_started"),

    passingYards: integer("passing_yards"),
    passingTouchdowns: integer("passing_touchdowns"),
    interceptions: integer("interceptions"),

    rushingAttempts: integer("rushing_attempts"),
    rushingYards: integer("rushing_yards"),
    rushingTouchdowns: integer("rushing_touchdowns"),

    receptions: integer("receptions"),
    receivingYards: integer("receiving_yards"),
    receivingTouchdowns: integer("receiving_touchdowns"),

    source: text("source"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("player_seasons_player_franchise_season_unique").on(
      table.playerId,
      table.franchiseId,
      table.season,
    ),
    index("player_seasons_franchise_season_idx").on(table.franchiseId, table.season),
  ],
);

/**
 * Normalized positions a player was eligible at during that season. A season
 * can carry several rows (RB + FB, RB + WR, TE + FB, ...).
 */
export const playerSeasonPositions = pgTable(
  "player_season_positions",
  {
    id: serial("id").primaryKey(),
    playerSeasonId: integer("player_season_id")
      .notNull()
      .references(() => playerSeasons.id, { onDelete: "cascade" }),
    position: normalizedPositionEnum("position").notNull(),
    isManualOverride: boolean("is_manual_override").notNull().default(false),
    notes: text("notes"),
  },
  (table) => [
    unique("player_season_positions_season_position_unique").on(
      table.playerSeasonId,
      table.position,
    ),
  ],
);

export type PlayerSeasonRow = typeof playerSeasons.$inferSelect;
export type NewPlayerSeasonRow = typeof playerSeasons.$inferInsert;
export type PlayerSeasonPositionRow = typeof playerSeasonPositions.$inferSelect;
export type NewPlayerSeasonPositionRow = typeof playerSeasonPositions.$inferInsert;
