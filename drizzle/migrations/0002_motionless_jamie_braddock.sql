CREATE TABLE "inventory_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"product_title" text NOT NULL,
	"variant_title" text DEFAULT '' NOT NULL,
	"inventory_quantity" integer DEFAULT 0 NOT NULL,
	"product_created_at" timestamp with time zone,
	"product_status" text DEFAULT 'ACTIVE' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"product_id" text NOT NULL,
	"variant_id" text NOT NULL,
	"product_title" text NOT NULL,
	"variant_title" text DEFAULT '' NOT NULL,
	"units_sold" integer DEFAULT 0 NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"date_range" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "inventory_cache_shop_idx" ON "inventory_cache" USING btree ("shop_id");
--> statement-breakpoint
CREATE INDEX "sales_cache_shop_date_idx" ON "sales_cache" USING btree ("shop_id","date_range");
