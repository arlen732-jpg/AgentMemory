CREATE TABLE "memory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memory_items_name_unique" UNIQUE("name")
);
--> statement-breakpoint
-- 2026/11/12 - Arlen - 加外鍵前，先把預設分類與既有記憶用到的分類補進 memory_items - Start
INSERT INTO "memory_items" ("name")
SELECT '個人'
UNION
SELECT DISTINCT "item" FROM "memories"
ON CONFLICT ("name") DO NOTHING;
-- 2026/11/12 - Arlen - 加外鍵前，先把預設分類與既有記憶用到的分類補進 memory_items - end
--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_item_memory_items_name_fk" FOREIGN KEY ("item") REFERENCES "public"."memory_items"("name") ON DELETE restrict ON UPDATE cascade;