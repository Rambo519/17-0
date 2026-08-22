CREATE TYPE "public"."game_status" AS ENUM('ACTIVE', 'COMPLETE');--> statement-breakpoint
CREATE TYPE "public"."lineup_slot" AS ENUM('QB', 'RB', 'FB', 'WR1', 'WR2', 'TE');--> statement-breakpoint
CREATE TYPE "public"."normalized_position" AS ENUM('QB', 'RB', 'FB', 'WR', 'TE');--> statement-breakpoint
CREATE TABLE "player_team_era_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"franchise_id" integer NOT NULL,
	"era_id" integer NOT NULL,
	"first_season" integer NOT NULL,
	"last_season" integer NOT NULL,
	"representative_season" integer,
	"draftable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_team_era_cards_player_franchise_era_unique" UNIQUE("player_id","franchise_id","era_id")
);
--> statement-breakpoint
CREATE TABLE "player_team_era_positions" (
	"player_team_era_card_id" integer NOT NULL,
	"position" "normalized_position" NOT NULL,
	CONSTRAINT "player_team_era_positions_pkey" PRIMARY KEY("player_team_era_card_id","position")
);
--> statement-breakpoint
CREATE TABLE "eras" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"start_year" integer NOT NULL,
	"end_year" integer NOT NULL,
	CONSTRAINT "eras_label_unique" UNIQUE("label")
);
--> statement-breakpoint
CREATE TABLE "franchise_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"franchise_id" integer NOT NULL,
	"season" integer NOT NULL,
	"display_name" text NOT NULL,
	"abbreviation" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "franchise_seasons_franchise_season_unique" UNIQUE("franchise_id","season")
);
--> statement-breakpoint
CREATE TABLE "franchises" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"canonical_name" text NOT NULL,
	"canonical_abbreviation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "franchises_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "game_picks" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_session_id" uuid NOT NULL,
	"round_number" integer NOT NULL,
	"lineup_slot" "lineup_slot" NOT NULL,
	"player_id" integer NOT NULL,
	"player_team_era_card_id" integer NOT NULL,
	"franchise_id" integer NOT NULL,
	"era_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "game_picks_session_slot_unique" UNIQUE("game_session_id","lineup_slot"),
	CONSTRAINT "game_picks_session_player_unique" UNIQUE("game_session_id","player_id"),
	CONSTRAINT "game_picks_session_round_unique" UNIQUE("game_session_id","round_number")
);
--> statement-breakpoint
CREATE TABLE "game_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "game_status" DEFAULT 'ACTIVE' NOT NULL,
	"current_franchise_id" integer,
	"current_era_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "players" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"display_name" text NOT NULL,
	"gsis_id" text,
	"pfr_id" text,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "players_gsis_id_unique" UNIQUE("gsis_id"),
	CONSTRAINT "players_pfr_id_unique" UNIQUE("pfr_id")
);
--> statement-breakpoint
CREATE TABLE "player_season_positions" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_season_id" integer NOT NULL,
	"position" "normalized_position" NOT NULL,
	"is_manual_override" boolean DEFAULT false NOT NULL,
	"notes" text,
	CONSTRAINT "player_season_positions_season_position_unique" UNIQUE("player_season_id","position")
);
--> statement-breakpoint
CREATE TABLE "player_seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"player_id" integer NOT NULL,
	"franchise_id" integer NOT NULL,
	"season" integer NOT NULL,
	"raw_position" text NOT NULL,
	"primary_normalized_position" "normalized_position" NOT NULL,
	"games" integer,
	"games_started" integer,
	"passing_yards" integer,
	"passing_touchdowns" integer,
	"interceptions" integer,
	"rushing_attempts" integer,
	"rushing_yards" integer,
	"rushing_touchdowns" integer,
	"receptions" integer,
	"receiving_yards" integer,
	"receiving_touchdowns" integer,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "player_seasons_player_franchise_season_unique" UNIQUE("player_id","franchise_id","season")
);
--> statement-breakpoint
ALTER TABLE "player_team_era_cards" ADD CONSTRAINT "player_team_era_cards_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_team_era_cards" ADD CONSTRAINT "player_team_era_cards_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_team_era_cards" ADD CONSTRAINT "player_team_era_cards_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_team_era_positions" ADD CONSTRAINT "player_team_era_positions_player_team_era_card_id_player_team_era_cards_id_fk" FOREIGN KEY ("player_team_era_card_id") REFERENCES "public"."player_team_era_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "franchise_seasons" ADD CONSTRAINT "franchise_seasons_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_picks" ADD CONSTRAINT "game_picks_game_session_id_game_sessions_id_fk" FOREIGN KEY ("game_session_id") REFERENCES "public"."game_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_picks" ADD CONSTRAINT "game_picks_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_picks" ADD CONSTRAINT "game_picks_player_team_era_card_id_player_team_era_cards_id_fk" FOREIGN KEY ("player_team_era_card_id") REFERENCES "public"."player_team_era_cards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_picks" ADD CONSTRAINT "game_picks_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_picks" ADD CONSTRAINT "game_picks_era_id_eras_id_fk" FOREIGN KEY ("era_id") REFERENCES "public"."eras"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_current_franchise_id_franchises_id_fk" FOREIGN KEY ("current_franchise_id") REFERENCES "public"."franchises"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_current_era_id_eras_id_fk" FOREIGN KEY ("current_era_id") REFERENCES "public"."eras"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_season_positions" ADD CONSTRAINT "player_season_positions_player_season_id_player_seasons_id_fk" FOREIGN KEY ("player_season_id") REFERENCES "public"."player_seasons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_seasons" ADD CONSTRAINT "player_seasons_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_seasons" ADD CONSTRAINT "player_seasons_franchise_id_franchises_id_fk" FOREIGN KEY ("franchise_id") REFERENCES "public"."franchises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_team_era_cards_franchise_era_idx" ON "player_team_era_cards" USING btree ("franchise_id","era_id");--> statement-breakpoint
CREATE INDEX "franchise_seasons_season_idx" ON "franchise_seasons" USING btree ("season");--> statement-breakpoint
CREATE INDEX "game_picks_session_idx" ON "game_picks" USING btree ("game_session_id");--> statement-breakpoint
CREATE INDEX "player_seasons_franchise_season_idx" ON "player_seasons" USING btree ("franchise_id","season");