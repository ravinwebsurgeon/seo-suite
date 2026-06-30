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

// ─── Permission error ─────────────────────────────────────────────────────────

/**
 * Returned by loaders when Shopify denies access due to missing
 * Protected Customer Data (PCD) approval for the Order object.
 */
export interface PcdPermissionError {
  success: false;
  errorType: "PCD_PERMISSION_REQUIRED";
  message: string;
}

/**
 * Thrown by service layer functions when Shopify returns a PCD access-denied
 * error. Caught in route loaders and converted to a PcdPermissionError response
 * so the UI can render the appropriate empty state instead of crashing.
 */
export class PCDPermissionError extends Error {
  readonly errorType = "PCD_PERMISSION_REQUIRED" as const;
  constructor(message = "This app is not approved to access the Order object.") {
    super(message);
    this.name = "PCDPermissionError";
    Object.setPrototypeOf(this, new.target.prototype);
  }

  static is(err: unknown): err is PCDPermissionError {
    return (
      err instanceof PCDPermissionError ||
      (err instanceof Error && err.name === "PCDPermissionError") ||
      (typeof err === "object" && err !== null && (err as { errorType?: string }).errorType === "PCD_PERMISSION_REQUIRED") ||
      PCDPermissionError.messageMatches(err)
    );
  }

  /**
   * Checks if an unknown thrown value contains Shopify's known PCD error message.
   * The Shopify SDK throws a plain Error with this exact text before our code
   * can inspect the response, so we must catch it by message.
   */
  static messageMatches(err: unknown): boolean {
    if (typeof err !== "object" || err === null) return false;
    const msg: string = (err as { message?: string }).message ?? "";
    return (
      /not approved to access the order object/i.test(msg) ||
      /protected customer data/i.test(msg) ||
      /protected_customer_data/i.test(msg)
    );
  }
}
