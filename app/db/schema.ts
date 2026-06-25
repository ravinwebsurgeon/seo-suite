import {
  bigint,
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const sessions = pgTable("Session", {
  id: text("id").primaryKey(),
  shop: text("shop").notNull(),
  state: text("state").notNull(),
  isOnline: boolean("isOnline").notNull().default(false),
  scope: text("scope"),
  expires: timestamp("expires", { withTimezone: true }),
  accessToken: text("accessToken").notNull().default(""),
  userId: bigint("userId", { mode: "bigint" }),
  firstName: text("firstName"),
  lastName: text("lastName"),
  email: text("email"),
  accountOwner: boolean("accountOwner").notNull().default(false),
  locale: text("locale"),
  collaborator: boolean("collaborator").default(false),
  emailVerified: boolean("emailVerified").default(false),
  refreshToken: text("refreshToken"),
  refreshTokenExpires: timestamp("refreshTokenExpires", { withTimezone: true }),
});

export type SessionRecord = typeof sessions.$inferSelect;
export type NewSessionRecord = typeof sessions.$inferInsert;

export const seoKeywords = pgTable("seo_keywords", {
  id: serial("id").primaryKey(),
  shopId: text("shop_id").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceType: text("resource_type").notNull(),
  keyword: text("keyword").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seoMetaGenerations = pgTable("seo_meta_generations", {
  id: serial("id").primaryKey(),
  shopId: text("shop_id").notNull(),
  resourceId: text("resource_id").notNull(),
  resourceType: text("resource_type").notNull(),
  currentTitle: text("current_title"),
  currentDescription: text("current_description"),
  generatedTitle: text("generated_title"),
  generatedDescription: text("generated_description"),
  tone: text("tone").default("professional"),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const seoGenerationJobs = pgTable("seo_generation_jobs", {
  id: serial("id").primaryKey(),
  shopId: text("shop_id").notNull(),
  jobId: text("job_id").notNull(),
  jobType: text("job_type").notNull(),
  status: text("status").notNull().default("queued"),
  totalRecords: integer("total_records").default(0).notNull(),
  processedRecords: integer("processed_records").default(0).notNull(),
  failedRecords: integer("failed_records").default(0).notNull(),
  errorLog: text("error_log"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SeoKeyword = typeof seoKeywords.$inferSelect;
export type NewSeoKeyword = typeof seoKeywords.$inferInsert;
export type SeoMetaGeneration = typeof seoMetaGenerations.$inferSelect;
export type NewSeoMetaGeneration = typeof seoMetaGenerations.$inferInsert;
export type SeoGenerationJob = typeof seoGenerationJobs.$inferSelect;
export type NewSeoGenerationJob = typeof seoGenerationJobs.$inferInsert;
