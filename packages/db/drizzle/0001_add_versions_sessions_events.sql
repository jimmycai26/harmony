CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "track_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"track_id" uuid NOT NULL,
	"session_id" uuid,
	"event_type" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX IF EXISTS "battles_request_round_unique";--> statement-breakpoint
-- No production data exists yet for this pre-launch schema, so the old
-- free-text session_id values (if any) are discarded rather than cast —
-- there was nothing to preserve a mapping for anyway once sessions became
-- a real FK'd table.
ALTER TABLE "generation_requests" DROP COLUMN "session_id";--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "models" ADD COLUMN "current_version" text;--> statement-breakpoint
ALTER TABLE "generation_requests" ADD COLUMN "generation_parameters" jsonb;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "model_version" text;--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "generation_parameters" jsonb;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "track_events" ADD CONSTRAINT "track_events_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "track_events" ADD CONSTRAINT "track_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_events_track_idx" ON "track_events" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "track_events_session_idx" ON "track_events" USING btree ("session_id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "generation_requests" ADD CONSTRAINT "generation_requests_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "battles_request_round_idx" ON "battles" USING btree ("generation_request_id","round");