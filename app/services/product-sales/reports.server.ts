import type {
  DateRangeConfig,
  BestSellerRow,
  ZeroSaleRow,
  HighDemandRow,
  SalesSummary,
  ReportResult,
} from "../../types/product-sales";
import {
  buildDateRangeKey,
  isSalesCacheFresh,
  isInventoryCacheFresh,
  getSalesCache,
  getInventoryCache,
  getSalesCacheTimestamp,
  getInventoryCacheTimestamp,
  writeSalesCache,
  writeInventoryCache,
} from "./cache.server";
import {
  fetchOrderAggregations,
  fetchAllProducts,
  fetchLast14DayAggregations,
} from "./shopify.server";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const HIGH_DEMAND_THRESHOLD = 0.5;

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getDateRange(preset: string, customStart?: string, customEnd?: string): DateRangeConfig {
  const today = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const endDate = fmt(today);

  if (preset === "custom" && customStart && customEnd) {
    return { preset: "custom", startDate: customStart, endDate: customEnd };
  }
  const days = preset === "7d" ? 7 : preset === "90d" ? 90 : 30;
  const start = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
  return { preset: preset as DateRangeConfig["preset"], startDate: fmt(start), endDate };
}

// ─── Core report builder ──────────────────────────────────────────────────────

export async function buildReport(
  admin: AdminClient,
  shopId: string,
  dateRange: DateRangeConfig,
  forceRefresh = false,
): Promise<ReportResult> {
  const rangeKey = buildDateRangeKey(dateRange.startDate, dateRange.endDate);

  // ── Ensure sales cache ──
  const salesFresh = !forceRefresh && (await isSalesCacheFresh(shopId, rangeKey));
  if (!salesFresh) {
    const { aggregations } = await fetchOrderAggregations(
      admin,
      dateRange.startDate,
      dateRange.endDate,
    );
    await writeSalesCache(shopId, rangeKey, aggregations);
  }

  // ── Ensure inventory cache ──
  const inventoryFresh = !forceRefresh && (await isInventoryCacheFresh(shopId));
  if (!inventoryFresh) {
    const products = await fetchAllProducts(admin);
    await writeInventoryCache(shopId, products);
  }

  // ── Read from cache ──
  const [salesRows, inventoryRows, salesTs, inventoryTs] = await Promise.all([
    getSalesCache(shopId, rangeKey),
    getInventoryCache(shopId),
    getSalesCacheTimestamp(shopId, rangeKey),
    getInventoryCacheTimestamp(shopId),
  ]);

  // Real "cached at" = the oldest of the two cached data sources this report
  // draws from, so the UI can tell how stale the data actually is.
  const cachedAt = oldestTimestamp(salesTs, inventoryTs);

  // Build lookup maps
  const salesByKey = new Map(
    salesRows.map((r) => [`${r.productId}__${r.variantId}`, r]),
  );
  const inventoryByKey = new Map(
    inventoryRows.map((r) => [`${r.productId}__${r.variantId}`, r]),
  );

  // Total revenue for percentage calc
  const totalRevenue = salesRows.reduce((sum, r) => sum + parseFloat(String(r.revenue)), 0);
  const totalUnitsSold = salesRows.reduce((sum, r) => sum + r.unitsSold, 0);
  const totalOrders = 0; // stored separately; approximate from agg count if needed

  // ── Best Sellers ──
  const bestSellers: BestSellerRow[] = salesRows
    .map((r) => {
      const inv = inventoryByKey.get(`${r.productId}__${r.variantId}`);
      const revenue = parseFloat(String(r.revenue));
      return {
        productId: r.productId,
        variantId: r.variantId,
        productTitle: r.productTitle,
        variantTitle: r.variantTitle,
        revenue,
        unitsSold: r.unitsSold,
        revenuePercentage: totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0,
        inventoryQuantity: inv?.inventoryQuantity ?? 0,
      };
    })
    .sort((a, b) => b.unitsSold - a.unitsSold);

  // ── Zero Sales ──
  const zeroSales: ZeroSaleRow[] = inventoryRows
    .filter((r) => !salesByKey.has(`${r.productId}__${r.variantId}`))
    .map((r) => ({
      productId: r.productId,
      variantId: r.variantId,
      productTitle: r.productTitle,
      variantTitle: r.variantTitle,
      inventoryQuantity: r.inventoryQuantity,
      createdAt: r.productCreatedAt ? r.productCreatedAt.toISOString() : "",
      lastSaleDate: null,
      daysSinceLastSale: null,
    }));

  // ── High Demand (always last 14 days, independent of date range) ──
  const agg14d = await fetchLast14DayAggregations(admin, new Date());
  const agg14dMap = new Map(agg14d.map((a) => [`${a.productId}__${a.variantId}`, a]));

  const highDemand: HighDemandRow[] = [];
  for (const [key, agg] of agg14dMap) {
    const inv = inventoryByKey.get(key);
    const inventory = inv?.inventoryQuantity ?? 0;
    const unitsSold14d = agg.unitsSold;
    const velocity = inventory > 0 ? unitsSold14d / inventory : unitsSold14d > 0 ? Infinity : 0;

    if (velocity > HIGH_DEMAND_THRESHOLD) {
      const dailyRate = unitsSold14d / 14;
      const estimatedDaysRemaining = dailyRate > 0 ? Math.floor(inventory / dailyRate) : null;
      highDemand.push({
        productId: agg.productId,
        variantId: agg.variantId,
        productTitle: agg.productTitle,
        variantTitle: agg.variantTitle,
        inventoryQuantity: inventory,
        unitsSold14d,
        salesVelocity: parseFloat(velocity === Infinity ? "999" : velocity.toFixed(2)),
        estimatedDaysRemaining,
      });
    }
  }
  highDemand.sort((a, b) => b.salesVelocity - a.salesVelocity);

  const summary: SalesSummary = {
    totalRevenue,
    totalOrders,
    totalUnitsSold,
    averageOrderValue: 0,
    bestSellerCount: bestSellers.length,
    zeroSaleCount: zeroSales.length,
    highDemandCount: highDemand.length,
  };

  return {
    dateRange,
    summary,
    bestSellers,
    zeroSales,
    highDemand,
    cachedAt,
  };
}

/** ISO string of the oldest non-null timestamp, or "now" if all are null. */
function oldestTimestamp(...dates: (Date | null)[]): string {
  const valid = dates.filter((d): d is Date => d != null);
  if (!valid.length) return new Date().toISOString();
  return valid.reduce((a, b) => (a.getTime() <= b.getTime() ? a : b)).toISOString();
}

// ─── Per-section loaders (used by individual route loaders) ───────────────────

export async function loadBestSellers(
  admin: AdminClient,
  shopId: string,
  dateRange: DateRangeConfig,
  forceRefresh = false,
): Promise<{ rows: BestSellerRow[]; cachedAt: string }> {
  const result = await buildReport(admin, shopId, dateRange, forceRefresh);
  return { rows: result.bestSellers, cachedAt: result.cachedAt };
}

export async function loadZeroSales(
  admin: AdminClient,
  shopId: string,
  dateRange: DateRangeConfig,
  forceRefresh = false,
): Promise<{ rows: ZeroSaleRow[]; cachedAt: string }> {
  const result = await buildReport(admin, shopId, dateRange, forceRefresh);
  return { rows: result.zeroSales, cachedAt: result.cachedAt };
}

export async function loadHighDemand(
  admin: AdminClient,
  shopId: string,
  forceRefresh = false,
): Promise<{ rows: HighDemandRow[]; cachedAt: string }> {
  const inventoryFresh = !forceRefresh && (await isInventoryCacheFresh(shopId));
  if (!inventoryFresh) {
    const products = await fetchAllProducts(admin);
    await writeInventoryCache(shopId, products);
  }

  const [inventoryRows, inventoryTs] = await Promise.all([
    getInventoryCache(shopId),
    getInventoryCacheTimestamp(shopId),
  ]);
  const inventoryByKey = new Map(
    inventoryRows.map((r) => [`${r.productId}__${r.variantId}`, r]),
  );

  const agg14d = await fetchLast14DayAggregations(admin, new Date());
  const highDemand: HighDemandRow[] = [];

  for (const agg of agg14d) {
    const key = `${agg.productId}__${agg.variantId}`;
    const inv = inventoryByKey.get(key);
    const inventory = inv?.inventoryQuantity ?? 0;
    const velocity = inventory > 0 ? agg.unitsSold / inventory : agg.unitsSold > 0 ? 999 : 0;

    if (velocity > HIGH_DEMAND_THRESHOLD) {
      const dailyRate = agg.unitsSold / 14;
      highDemand.push({
        productId: agg.productId,
        variantId: agg.variantId,
        productTitle: agg.productTitle,
        variantTitle: agg.variantTitle,
        inventoryQuantity: inventory,
        unitsSold14d: agg.unitsSold,
        salesVelocity: parseFloat(velocity.toFixed(2)),
        estimatedDaysRemaining: dailyRate > 0 ? Math.floor(inventory / dailyRate) : null,
      });
    }
  }

  highDemand.sort((a, b) => b.salesVelocity - a.salesVelocity);
  return { rows: highDemand, cachedAt: (inventoryTs ?? new Date()).toISOString() };
}
