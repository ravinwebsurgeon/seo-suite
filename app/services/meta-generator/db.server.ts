import { eq, and, inArray, sql } from "drizzle-orm";
import db from "../../db.server";
import {
  seoKeywords,
  seoMetaGenerations,
  seoGenerationJobs,
} from "../../db/schema";
import type {
  MetaStatus,
  JobStatus,
  JobType,
  Tone,
  ResourceType,
} from "../../types/meta-generator";

// ─── Keywords ─────────────────────────────────────────────────────────────────

export async function getKeyword(
  shopId: string,
  resourceId: string,
): Promise<string | null> {
  const row = await db.query.seoKeywords.findFirst({
    where: and(
      eq(seoKeywords.shopId, shopId),
      eq(seoKeywords.resourceId, resourceId),
    ),
  });
  return row?.keyword ?? null;
}

export async function getKeywordsForIds(
  shopId: string,
  resourceIds: string[],
): Promise<Map<string, string>> {
  if (resourceIds.length === 0) return new Map();
  const rows = await db
    .select()
    .from(seoKeywords)
    .where(
      and(
        eq(seoKeywords.shopId, shopId),
        inArray(seoKeywords.resourceId, resourceIds),
      ),
    );
  return new Map(rows.map((r) => [r.resourceId, r.keyword]));
}

export async function upsertKeyword(
  shopId: string,
  resourceId: string,
  resourceType: ResourceType,
  keyword: string,
): Promise<void> {
  // Atomic upsert keyed by the (shop_id, resource_id) unique index. Avoids the
  // duplicate rows the previous insert-then-find approach produced when no
  // unique constraint existed.
  await db
    .insert(seoKeywords)
    .values({ shopId, resourceId, resourceType, keyword, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [seoKeywords.shopId, seoKeywords.resourceId],
      set: { keyword, updatedAt: new Date() },
    });
}

// ─── Meta Generations ─────────────────────────────────────────────────────────

export async function getMetaRecord(
  shopId: string,
  resourceId: string,
) {
  return db.query.seoMetaGenerations.findFirst({
    where: and(
      eq(seoMetaGenerations.shopId, shopId),
      eq(seoMetaGenerations.resourceId, resourceId),
    ),
  });
}

export async function getMetaRecordsForIds(
  shopId: string,
  resourceIds: string[],
) {
  if (resourceIds.length === 0) return [];
  return db
    .select()
    .from(seoMetaGenerations)
    .where(
      and(
        eq(seoMetaGenerations.shopId, shopId),
        inArray(seoMetaGenerations.resourceId, resourceIds),
      ),
    );
}

export async function upsertMetaRecord(params: {
  shopId: string;
  resourceId: string;
  resourceType: ResourceType;
  currentTitle?: string | null;
  currentDescription?: string | null;
  generatedTitle?: string | null;
  generatedDescription?: string | null;
  tone?: Tone;
  status?: MetaStatus;
  errorMessage?: string | null;
}) {
  // Atomic upsert keyed by the (shop_id, resource_id) unique index. Only the
  // fields actually supplied are overwritten on conflict, so a partial save
  // (e.g. editing just the generated title) never clobbers other columns.
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (params.currentTitle !== undefined) set.currentTitle = params.currentTitle;
  if (params.currentDescription !== undefined) set.currentDescription = params.currentDescription;
  if (params.generatedTitle !== undefined) set.generatedTitle = params.generatedTitle;
  if (params.generatedDescription !== undefined) set.generatedDescription = params.generatedDescription;
  if (params.tone !== undefined) set.tone = params.tone;
  if (params.status !== undefined) set.status = params.status;
  if (params.errorMessage !== undefined) set.errorMessage = params.errorMessage;

  const [row] = await db
    .insert(seoMetaGenerations)
    .values({
      shopId: params.shopId,
      resourceId: params.resourceId,
      resourceType: params.resourceType,
      currentTitle: params.currentTitle ?? null,
      currentDescription: params.currentDescription ?? null,
      generatedTitle: params.generatedTitle ?? null,
      generatedDescription: params.generatedDescription ?? null,
      tone: params.tone ?? "professional",
      status: params.status ?? "pending",
      errorMessage: params.errorMessage ?? null,
    })
    .onConflictDoUpdate({
      target: [seoMetaGenerations.shopId, seoMetaGenerations.resourceId],
      set,
    })
    .returning({ id: seoMetaGenerations.id });
  return row.id;
}

export async function updateMetaStatus(
  shopId: string,
  resourceId: string,
  status: MetaStatus,
  errorMessage?: string | null,
) {
  await db
    .update(seoMetaGenerations)
    .set({ status, errorMessage: errorMessage ?? null, updatedAt: new Date() })
    .where(
      and(
        eq(seoMetaGenerations.shopId, shopId),
        eq(seoMetaGenerations.resourceId, resourceId),
      ),
    );
}

export async function bulkUpdateMetaStatus(
  shopId: string,
  resourceIds: string[],
  status: MetaStatus,
) {
  if (resourceIds.length === 0) return;
  await db
    .update(seoMetaGenerations)
    .set({ status, updatedAt: new Date() })
    .where(
      and(
        eq(seoMetaGenerations.shopId, shopId),
        inArray(seoMetaGenerations.resourceId, resourceIds),
      ),
    );
}

export async function getMetaStatsByShop(shopId: string) {
  const rows = await db
    .select({ status: seoMetaGenerations.status })
    .from(seoMetaGenerations)
    .where(eq(seoMetaGenerations.shopId, shopId));

  const counts = { generated: 0, approved: 0, published: 0, failed: 0, pending: 0 };
  for (const row of rows) {
    if (row.status === "generated") counts.generated++;
    else if (row.status === "approved") counts.approved++;
    else if (row.status === "published") counts.published++;
    else if (row.status === "failed") counts.failed++;
    else counts.pending++;
  }
  return counts;
}

export async function getMetaRecordsByStatus(
  shopId: string,
  status: MetaStatus,
) {
  return db
    .select()
    .from(seoMetaGenerations)
    .where(
      and(
        eq(seoMetaGenerations.shopId, shopId),
        eq(seoMetaGenerations.status, status),
      ),
    );
}

export async function getResourceIdsByStatus(
  shopId: string,
  status: MetaStatus,
  resourceType?: "product" | "article",
): Promise<string[]> {
  const conditions = [
    eq(seoMetaGenerations.shopId, shopId),
    eq(seoMetaGenerations.status, status),
    ...(resourceType ? [eq(seoMetaGenerations.resourceType, resourceType)] : []),
  ];
  const rows = await db
    .select({ resourceId: seoMetaGenerations.resourceId })
    .from(seoMetaGenerations)
    .where(and(...conditions));
  return rows.map((r) => r.resourceId);
}

// Resource IDs that have a row in any of the given statuses. Used to derive the
// "pending" set (= every catalog resource NOT in an acted status).
export async function getResourceIdsByStatuses(
  shopId: string,
  statuses: MetaStatus[],
  resourceType?: "product" | "article",
): Promise<string[]> {
  if (statuses.length === 0) return [];
  const conditions = [
    eq(seoMetaGenerations.shopId, shopId),
    inArray(seoMetaGenerations.status, statuses),
    ...(resourceType ? [eq(seoMetaGenerations.resourceType, resourceType)] : []),
  ];
  const rows = await db
    .select({ resourceId: seoMetaGenerations.resourceId })
    .from(seoMetaGenerations)
    .where(and(...conditions));
  return rows.map((r) => r.resourceId);
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export async function createJob(params: {
  shopId: string;
  jobId: string;
  jobType: JobType;
  totalRecords: number;
}): Promise<number> {
  const [row] = await db
    .insert(seoGenerationJobs)
    .values({
      shopId: params.shopId,
      jobId: params.jobId,
      jobType: params.jobType,
      status: "queued",
      totalRecords: params.totalRecords,
      processedRecords: 0,
      failedRecords: 0,
    })
    .returning({ id: seoGenerationJobs.id });
  return row.id;
}

export async function updateJobProgress(
  jobId: string,
  params: {
    status?: JobStatus;
    processedRecords?: number;
    failedRecords?: number;
    errorLog?: string | null;
  },
) {
  await db
    .update(seoGenerationJobs)
    .set({
      ...(params.status !== undefined && { status: params.status }),
      ...(params.processedRecords !== undefined && { processedRecords: params.processedRecords }),
      ...(params.failedRecords !== undefined && { failedRecords: params.failedRecords }),
      ...(params.errorLog !== undefined && { errorLog: params.errorLog }),
      updatedAt: new Date(),
    })
    .where(eq(seoGenerationJobs.jobId, jobId));
}

export async function getJobsByShop(shopId: string) {
  return db
    .select()
    .from(seoGenerationJobs)
    .where(eq(seoGenerationJobs.shopId, shopId))
    .orderBy(sql`${seoGenerationJobs.createdAt} DESC`)
    .limit(100);
}

export async function getJobById(jobId: string) {
  return db.query.seoGenerationJobs.findFirst({
    where: eq(seoGenerationJobs.jobId, jobId),
  });
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  await db
    .update(seoGenerationJobs)
    .set({ status, updatedAt: new Date() })
    .where(eq(seoGenerationJobs.jobId, jobId));
}

export async function getQueueStats(shopId: string) {
  const rows = await db
    .select({ status: seoGenerationJobs.status })
    .from(seoGenerationJobs)
    .where(eq(seoGenerationJobs.shopId, shopId));

  const stats = { active: 0, completed: 0, failed: 0 };
  for (const row of rows) {
    if (row.status === "queued" || row.status === "processing") stats.active++;
    else if (row.status === "completed") stats.completed++;
    else if (row.status === "failed") stats.failed++;
  }
  return stats;
}
