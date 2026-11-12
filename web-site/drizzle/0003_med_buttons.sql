CREATE TABLE "med_button_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"button_id" uuid NOT NULL,
	"drug" varchar(50) NOT NULL,
	"dose" varchar(30) NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "med_buttons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(20) NOT NULL,
	"sort" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "med_buttons_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "med_button_items" ADD CONSTRAINT "med_button_items_button_id_med_buttons_id_fk" FOREIGN KEY ("button_id") REFERENCES "public"."med_buttons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "med_button_items_button_idx" ON "med_button_items" USING btree ("button_id");--> statement-breakpoint
-- 2026/11/12 - Arlen - 預設 4 顆吃藥按鈕（藥單由使用者到設定畫面填）
INSERT INTO "med_buttons" ("name", "sort") VALUES ('早上', 1), ('中午', 2), ('晚上', 3), ('睡前', 4) ON CONFLICT ("name") DO NOTHING;