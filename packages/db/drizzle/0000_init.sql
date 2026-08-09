CREATE TYPE "public"."generation_genre" AS ENUM('pop', 'lofi', 'cinematic', 'electronic', 'jazz');--> statement-breakpoint
CREATE TYPE "public"."generation_scope" AS ENUM('full_song', 'just_a_beat', 'vocal_take', 'instrumental_only');--> statement-breakpoint
CREATE TYPE "public"."pick" AS ENUM('left', 'tie', 'right');--> statement-breakpoint
CREATE TYPE "public"."track_status" AS ENUM('pending', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"provider" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "models_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "generation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"scope" "generation_scope" NOT NULL,
	"genre" "generation_genre" NOT NULL,
	"session_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_request_id" uuid NOT NULL,
	"model_id" uuid NOT NULL,
	"blind_label" text NOT NULL,
	"status" "track_status" DEFAULT 'pending' NOT NULL,
	"audio_object_key" text,
	"duration_seconds" integer,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"generation_request_id" uuid NOT NULL,
	"round" integer NOT NULL,
	"left_track_id" uuid NOT NULL,
	"right_track_id" uuid NOT NULL,
	"result" "pick",
	"winner_track_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"voted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "battle_axis_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_id" uuid NOT NULL,
	"axis_key" text NOT NULL,
	"pick" "pick" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracks" ADD CONSTRAINT "tracks_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "tracks" ADD CONSTRAINT "tracks_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_generation_request_id_generation_requests_id_fk" FOREIGN KEY ("generation_request_id") REFERENCES "public"."generation_requests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_left_track_id_tracks_id_fk" FOREIGN KEY ("left_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_right_track_id_tracks_id_fk" FOREIGN KEY ("right_track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battles" ADD CONSTRAINT "battles_winner_track_id_tracks_id_fk" FOREIGN KEY ("winner_track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "battle_axis_votes" ADD CONSTRAINT "battle_axis_votes_battle_id_battles_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracks_request_model_unique" ON "tracks" USING btree ("generation_request_id","model_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tracks_request_label_unique" ON "tracks" USING btree ("generation_request_id","blind_label");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "battles_request_round_unique" ON "battles" USING btree ("generation_request_id","round");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "battle_axis_votes_battle_axis_unique" ON "battle_axis_votes" USING btree ("battle_id","axis_key");