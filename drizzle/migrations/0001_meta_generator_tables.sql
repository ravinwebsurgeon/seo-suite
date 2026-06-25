CREATE TABLE IF NOT EXISTS "seo_keywords" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"keyword" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seo_meta_generations" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"resource_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"current_title" text,
	"current_description" text,
	"generated_title" text,
	"generated_description" text,
	"tone" text DEFAULT 'professional',
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "seo_generation_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" text NOT NULL,
	"job_id" text NOT NULL,
	"job_type" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"total_records" integer DEFAULT 0 NOT NULL,
	"processed_records" integer DEFAULT 0 NOT NULL,
	"failed_records" integer DEFAULT 0 NOT NULL,
	"error_log" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
