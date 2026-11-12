CREATE TABLE "api_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(30) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"token_preview" varchar(4) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "api_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "bp_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"systolic" smallint NOT NULL,
	"diastolic" smallint NOT NULL,
	"pulse" smallint,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bp_systolic_range" CHECK ("bp_records"."systolic" between 50 and 300),
	CONSTRAINT "bp_diastolic_range" CHECK ("bp_records"."diastolic" between 30 and 200),
	CONSTRAINT "bp_pulse_range" CHECK ("bp_records"."pulse" is null or "bp_records"."pulse" between 30 and 250),
	CONSTRAINT "bp_sys_gt_dia" CHECK ("bp_records"."systolic" > "bp_records"."diastolic")
);
--> statement-breakpoint
CREATE TABLE "login_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"line_user_id" varchar(64) NOT NULL,
	"success" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "med_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"drug" varchar(50) NOT NULL,
	"dose" varchar(30) NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item" varchar(20) DEFAULT '個人' NOT NULL,
	"key" varchar(50) NOT NULL,
	"summary" varchar(30) NOT NULL,
	"value" varchar(2000) NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memories_key_not_index" CHECK (lower("memories"."key") <> 'index')
);
--> statement-breakpoint
CREATE INDEX "bp_measured_at_idx" ON "bp_records" USING btree ("measured_at");--> statement-breakpoint
CREATE INDEX "med_taken_at_idx" ON "med_records" USING btree ("taken_at");--> statement-breakpoint
CREATE INDEX "med_drug_idx" ON "med_records" USING btree ("drug");--> statement-breakpoint
CREATE UNIQUE INDEX "memories_item_key_uq" ON "memories" USING btree ("item","key");--> statement-breakpoint
CREATE INDEX "memories_tags_gin" ON "memories" USING gin ("tags");