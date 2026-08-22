import { pgTable, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

/**
 * Internal `id` is the primary identity for a player. Provider ids are
 * nullable secondary identifiers used to reconcile future imports.
 */
export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    displayName: text("display_name").notNull(),

    gsisId: text("gsis_id"),
    pfrId: text("pfr_id"),
    externalId: text("external_id"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("players_gsis_id_unique").on(table.gsisId),
    unique("players_pfr_id_unique").on(table.pfrId),
  ],
);

export type PlayerRow = typeof players.$inferSelect;
export type NewPlayerRow = typeof players.$inferInsert;
