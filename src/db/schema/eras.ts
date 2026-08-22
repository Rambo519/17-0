import { integer, pgTable, serial, text, unique } from "drizzle-orm/pg-core";

export const eras = pgTable(
  "eras",
  {
    id: serial("id").primaryKey(),
    label: text("label").notNull(),
    startYear: integer("start_year").notNull(),
    endYear: integer("end_year").notNull(),
  },
  (table) => [unique("eras_label_unique").on(table.label)],
);

export type EraRow = typeof eras.$inferSelect;
export type NewEraRow = typeof eras.$inferInsert;
