import {
  boolean,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

import { normalizedPositionEnum } from "./enums";
import { eras } from "./eras";
import { franchises } from "./franchises";
import { players } from "./players";

/**
 * The draftable unit of the game: one player's stint with one franchise inside
 * one era. A player who changed teams mid-decade gets one card per franchise.
 */
export const playerTeamEraCards = pgTable(
  "player_team_era_cards",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "cascade" }),
    eraId: integer("era_id")
      .notNull()
      .references(() => eras.id, { onDelete: "cascade" }),

    firstSeason: integer("first_season").notNull(),
    lastSeason: integer("last_season").notNull(),
    representativeSeason: integer("representative_season"),

    draftable: boolean("draftable").notNull().default(true),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("player_team_era_cards_player_franchise_era_unique").on(
      table.playerId,
      table.franchiseId,
      table.eraId,
    ),
    index("player_team_era_cards_franchise_era_idx").on(table.franchiseId, table.eraId),
  ],
);

export const playerTeamEraPositions = pgTable(
  "player_team_era_positions",
  {
    playerTeamEraCardId: integer("player_team_era_card_id")
      .notNull()
      .references(() => playerTeamEraCards.id, { onDelete: "cascade" }),
    position: normalizedPositionEnum("position").notNull(),
  },
  (table) => [
    primaryKey({
      name: "player_team_era_positions_pkey",
      columns: [table.playerTeamEraCardId, table.position],
    }),
  ],
);

export type PlayerTeamEraCardRow = typeof playerTeamEraCards.$inferSelect;
export type NewPlayerTeamEraCardRow = typeof playerTeamEraCards.$inferInsert;
export type PlayerTeamEraPositionRow = typeof playerTeamEraPositions.$inferSelect;
export type NewPlayerTeamEraPositionRow = typeof playerTeamEraPositions.$inferInsert;
