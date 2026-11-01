CREATE TABLE "account_sync_state" (
	"account_id" text PRIMARY KEY,
	"last_seq" bigint DEFAULT 0 NOT NULL,
	"min_valid_seq" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changes" (
	"account_id" text,
	"seq" bigint,
	"node_id" uuid NOT NULL,
	"node_kind" varchar NOT NULL,
	"op" varchar NOT NULL,
	"revision" integer NOT NULL,
	"payload" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "changes_pkey" PRIMARY KEY("account_id","seq")
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"label" varchar NOT NULL,
	"user_agent" varchar,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "file_revisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"file_id" uuid NOT NULL,
	"revision" integer NOT NULL,
	"storage_key" text NOT NULL,
	"size" bigint NOT NULL,
	"content_hash" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"device_id" uuid,
	"run_id" varchar NOT NULL,
	"trigger" varchar NOT NULL,
	"started_at" timestamp NOT NULL,
	"finished_at" timestamp NOT NULL,
	"counts" jsonb NOT NULL,
	"bytes_up" bigint NOT NULL,
	"bytes_down" bigint NOT NULL,
	"status" varchar NOT NULL,
	"error_summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"device_id" uuid,
	"file_id" uuid,
	"parent_id" uuid,
	"name" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"base_revision" integer,
	"expected_size" bigint NOT NULL,
	"expected_hash" varchar NOT NULL,
	"mtime" timestamp,
	"storage_key" text NOT NULL,
	"part_size" integer,
	"multipart_upload_id" text,
	"status" varchar DEFAULT 'open' NOT NULL,
	"idempotency_key" varchar NOT NULL,
	"result_file_id" uuid,
	"result_revision" integer,
	"result_seq" bigint,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "content_hash" varchar;--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "mtime" timestamp;--> statement-breakpoint
ALTER TABLE "folder" ADD COLUMN "revision" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "size" SET DATA TYPE bigint USING "size"::bigint;--> statement-breakpoint
CREATE UNIQUE INDEX "file_revisions_file_rev_uidx" ON "file_revisions" ("file_id","revision");--> statement-breakpoint
CREATE UNIQUE INDEX "sync_logs_user_run_uidx" ON "sync_logs" ("user_id","run_id");--> statement-breakpoint
CREATE INDEX "sync_logs_user_created_idx" ON "sync_logs" ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "upload_sessions_user_key_uidx" ON "upload_sessions" ("user_id","idempotency_key");--> statement-breakpoint
ALTER TABLE "account_sync_state" ADD CONSTRAINT "account_sync_state_account_id_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "changes" ADD CONSTRAINT "changes_account_id_user_id_fkey" FOREIGN KEY ("account_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "file_revisions" ADD CONSTRAINT "file_revisions_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sync_logs" ADD CONSTRAINT "sync_logs_device_id_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_device_id_devices_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "upload_sessions" ADD CONSTRAINT "upload_sessions_file_id_files_id_fkey" FOREIGN KEY ("file_id") REFERENCES "files"("id") ON DELETE SET NULL;