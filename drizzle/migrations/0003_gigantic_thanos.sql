-- Remove any duplicate rows the previous (constraint-less) upsert may have
-- created, keeping the most-recently-updated row per (shop_id, resource_id),
-- so the unique indexes below can be created safely.
DELETE FROM "seo_keywords" a
  USING "seo_keywords" b
  WHERE a."shop_id" = b."shop_id"
    AND a."resource_id" = b."resource_id"
    AND (a."updated_at" < b."updated_at" OR (a."updated_at" = b."updated_at" AND a."id" < b."id"));
--> statement-breakpoint
DELETE FROM "seo_meta_generations" a
  USING "seo_meta_generations" b
  WHERE a."shop_id" = b."shop_id"
    AND a."resource_id" = b."resource_id"
    AND (a."updated_at" < b."updated_at" OR (a."updated_at" = b."updated_at" AND a."id" < b."id"));
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_keywords_shop_resource_idx" ON "seo_keywords" USING btree ("shop_id","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "seo_meta_generations_shop_resource_idx" ON "seo_meta_generations" USING btree ("shop_id","resource_id");
