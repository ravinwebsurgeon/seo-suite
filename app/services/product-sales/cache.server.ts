import { eq, and, sql } from "drizzle-orm";
import db from "../../db.server";
import { salesCache, inventoryCache } from "../../db/schema";
import type { NewSalesCache, NewInventoryCache, SalesCache, InventoryCache } from "../../db/schema";
import type { LineItemAgg, ShopifyProduct } from "../../types/product-sales";

const CACHE_TTL_MINUTES = 30;

// ─── Cache key ────────────────────────────────────────────────────────────────

export function buildDateRangeKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}

// ─── Sales cache ──────────────────────────────────────────────────────────────

export async function getSalesCacheAge(shopId: string, dateRange: string): Promise<number | null> {
  const rows = await db
    .select({ createdAt: salesCache.createdAt })
    .from(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)))
    .limit(1);

  if (!rows.length) return null;
  const ageMs = Date.now() - new Date(rows[0].createdAt).getTime();
  return Math.floor(ageMs / 60_000);
}

export async function isSalesCacheFresh(shopId: string, dateRange: string): Promise<boolean> {
  const ageMinutes = await getSalesCacheAge(shopId, dateRange);
  return ageMinutes !== null && ageMinutes < CACHE_TTL_MINUTES;
}

/** Timestamp of when this sales-cache entry was written (null if none). */
export async function getSalesCacheTimestamp(shopId: string, dateRange: string): Promise<Date | null> {
  const rows = await db
    .select({ createdAt: salesCache.createdAt })
    .from(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)))
    .limit(1);
  return rows.length ? new Date(rows[0].createdAt) : null;
}

export async function getSalesCache(shopId: string, dateRange: string): Promise<SalesCache[]> {
  return db
    .select()
    .from(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)));
}

export async function writeSalesCache(
  shopId: string,
  dateRange: string,
  aggregations: LineItemAgg[],
): Promise<void> {
  // Clear stale data for this shop + date range first
  await db
    .delete(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)));

  if (!aggregations.length) return;

  const rows: NewSalesCache[] = aggregations.map((a) => ({
    shopId,
    productId: a.productId,
    variantId: a.variantId,
    productTitle: a.productTitle,
    variantTitle: a.variantTitle,
    unitsSold: a.unitsSold,
    revenue: String(a.revenue.toFixed(2)),
    dateRange,
  }));

  // Insert in batches of 500 to avoid query size limits
  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(salesCache).values(rows.slice(i, i + 500));
  }
}

export async function clearSalesCache(shopId: string, dateRange: string): Promise<void> {
  await db
    .delete(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)));
}

// ─── Inventory cache ──────────────────────────────────────────────────────────

export async function isInventoryCacheFresh(shopId: string): Promise<boolean> {
  const rows = await db
    .select({ updatedAt: inventoryCache.updatedAt })
    .from(inventoryCache)
    .where(eq(inventoryCache.shopId, shopId))
    .limit(1);

  if (!rows.length) return false;
  const ageMs = Date.now() - new Date(rows[0].updatedAt).getTime();
  return ageMs < CACHE_TTL_MINUTES * 60_000;
}

export async function getInventoryCache(shopId: string): Promise<InventoryCache[]> {
  return db.select().from(inventoryCache).where(eq(inventoryCache.shopId, shopId));
}

/** Timestamp of when the inventory cache was last written (null if none). */
export async function getInventoryCacheTimestamp(shopId: string): Promise<Date | null> {
  const rows = await db
    .select({ updatedAt: inventoryCache.updatedAt })
    .from(inventoryCache)
    .where(eq(inventoryCache.shopId, shopId))
    .limit(1);
  return rows.length ? new Date(rows[0].updatedAt) : null;
}

export async function writeInventoryCache(
  shopId: string,
  products: ShopifyProduct[],
): Promise<void> {
  await db.delete(inventoryCache).where(eq(inventoryCache.shopId, shopId));

  const rows: NewInventoryCache[] = [];
  for (const p of products) {
    for (const v of p.variants) {
      rows.push({
        shopId,
        productId: p.productId,
        variantId: v.variantId,
        productTitle: p.productTitle,
        variantTitle: v.variantTitle,
        inventoryQuantity: v.inventoryQuantity,
        productCreatedAt: new Date(p.createdAt),
        productStatus: p.status,
      });
    }
  }

  for (let i = 0; i < rows.length; i += 500) {
    await db.insert(inventoryCache).values(rows.slice(i, i + 500));
  }
}

export async function clearInventoryCache(shopId: string): Promise<void> {
  await db.delete(inventoryCache).where(eq(inventoryCache.shopId, shopId));
}

// ─── Aggregate stats from sales cache ────────────────────────────────────────

export async function getSalesSummaryFromCache(
  shopId: string,
  dateRange: string,
): Promise<{ totalRevenue: number; totalUnitsSold: number } | null> {
  const result = await db
    .select({
      totalRevenue: sql<string>`sum(${salesCache.revenue})`,
      totalUnitsSold: sql<string>`sum(${salesCache.unitsSold})`,
    })
    .from(salesCache)
    .where(and(eq(salesCache.shopId, shopId), eq(salesCache.dateRange, dateRange)));

  if (!result[0] || result[0].totalRevenue === null) return null;
  return {
    totalRevenue: parseFloat(result[0].totalRevenue ?? "0"),
    totalUnitsSold: parseInt(result[0].totalUnitsSold ?? "0", 10),
  };
}
