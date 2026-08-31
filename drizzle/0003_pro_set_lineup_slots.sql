CREATE TYPE "public"."lineup_slot_new" AS ENUM('QB', 'RB1', 'RB2', 'WR1', 'WR2', 'TE');--> statement-breakpoint
ALTER TABLE "game_picks" ALTER COLUMN "lineup_slot" TYPE "public"."lineup_slot_new" USING (
  CASE "lineup_slot"::text
    WHEN 'RB' THEN 'RB1'
    WHEN 'FB' THEN 'RB2'
    ELSE "lineup_slot"::text
  END
)::"public"."lineup_slot_new";--> statement-breakpoint
DROP TYPE "public"."lineup_slot";--> statement-breakpoint
ALTER TYPE "public"."lineup_slot_new" RENAME TO "lineup_slot";
