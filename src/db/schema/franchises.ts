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

/**
 * A franchise is the permanent organizational identity. Abbreviations and city
 * names move around over time, so they never act as the franchise key.
 */
export const franchises = pgTable(
  "franchises",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull(),
    canonicalName: text("canonical_name").notNull(),
    canonicalAbbreviation: text("canonical_abbreviation").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [unique("franchises_slug_unique").on(table.slug)],
);

/**
 * The name/abbreviation a franchise actually used in a given season, which is
 * how relocations and rebrands stay attached to one organization.
 */
export const franchiseSeasons = pgTable(
  "franchise_seasons",
  {
    id: serial("id").primaryKey(),
    franchiseId: integer("franchise_id")
      .notNull()
      .references(() => franchises.id, { onDelete: "cascade" }),
    season: integer("season").notNull(),
    displayName: text("display_name").notNull(),
    abbreviation: text("abbreviation").notNull(),
    active: boolean("active").notNull().default(true),
  },
  (table) => [
    unique("franchise_seasons_franchise_season_unique").on(table.franchiseId, table.season),
    index("franchise_seasons_season_idx").on(table.season),
  ],
);

export type FranchiseRow = typeof franchises.$inferSelect;
export type NewFranchiseRow = typeof franchises.$inferInsert;
export type FranchiseSeasonRow = typeof franchiseSeasons.$inferSelect;
export type NewFranchiseSeasonRow = typeof franchiseSeasons.$inferInsert;
