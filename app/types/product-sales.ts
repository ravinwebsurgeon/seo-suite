export type DatePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRangeConfig {
  preset: DatePreset;
  startDate: string; // ISO date string YYYY-MM-DD
  endDate: string;   // ISO date string YYYY-MM-DD
}

export type SortDir = "asc" | "desc";

// ─── Summary ──────────────────────────────────────────────────────────────────

export interface SalesSummary {
  totalRevenue: number;
  totalOrders: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  bestSellerCount: number;
  zeroSaleCount: number;
  highDemandCount: number;
}

// ─── Best Sellers ─────────────────────────────────────────────────────────────

export type BestSellerSortKey = "unitsSold" | "revenue" | "revenuePercentage" | "inventoryQuantity";

export interface BestSellerRow {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  revenue: number;
  unitsSold: number;
  revenuePercentage: number;
  inventoryQuantity: number;
}

// ─── Zero Sales ───────────────────────────────────────────────────────────────

export interface ZeroSaleRow {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  inventoryQuantity: number;
  createdAt: string;
  lastSaleDate: string | null;
  daysSinceLastSale: number | null;
}

// ─── High Demand / Low Stock ──────────────────────────────────────────────────

export type HighDemandSortKey = "salesVelocity" | "unitsSold14d" | "inventoryQuantity" | "estimatedDaysRemaining";

export interface HighDemandRow {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  inventoryQuantity: number;
  unitsSold14d: number;
  salesVelocity: number;
  estimatedDaysRemaining: number | null;
}

// ─── Internal service types ───────────────────────────────────────────────────

export interface LineItemAgg {
  productId: string;
  variantId: string;
  productTitle: string;
  variantTitle: string;
  unitsSold: number;
  revenue: number;
}

export interface ProductVariant {
  variantId: string;
  variantTitle: string;
  inventoryQuantity: number;
}

export interface ShopifyProduct {
  productId: string;
  productTitle: string;
  status: string;
  createdAt: string;
  variants: ProductVariant[];
}

export interface ReportResult {
  dateRange: DateRangeConfig;
  summary: SalesSummary;
  bestSellers: BestSellerRow[];
  zeroSales: ZeroSaleRow[];
  highDemand: HighDemandRow[];
  cachedAt: string;
}
