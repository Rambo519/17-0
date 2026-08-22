CREATE TYPE "public"."game_mode" AS ENUM('CLASSIC', 'IQ');--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "mode" "game_mode" DEFAULT 'CLASSIC' NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "team_skip_remaining" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD COLUMN "era_skip_remaining" integer DEFAULT 1 NOT NULL;