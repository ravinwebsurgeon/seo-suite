import type { LineItemAgg, ShopifyProduct } from "../../types/product-sales";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

// ─── GraphQL queries ──────────────────────────────────────────────────────────

const ORDERS_QUERY = `#graphql
  query GetOrdersForSales($first: Int!, $after: String, $query: String) {
    orders(first: $first, after: $after, query: $query) {
      nodes {
        id
        lineItems(first: 250) {
          nodes {
            quantity
            originalTotalSet {
              shopMoney {
                amount
              }
            }
            product {
              id
              title
            }
            variant {
              id
              title
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const PRODUCTS_QUERY = `#graphql
  query GetProductsForInventory($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        status
        createdAt
        variants(first: 100) {
          nodes {
            id
            title
            inventoryQuantity
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// ─── Response types ───────────────────────────────────────────────────────────

interface GqlLineItem {
  quantity: number;
  originalTotalSet: { shopMoney: { amount: string } };
  product: { id: string; title: string } | null;
  variant: { id: string; title: string } | null;
}

interface GqlOrder {
  id: string;
  lineItems: { nodes: GqlLineItem[] };
}

interface OrdersPage {
  data: {
    orders: {
      nodes: GqlOrder[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

interface GqlVariant {
  id: string;
  title: string;
  inventoryQuantity: number;
}

interface GqlProduct {
  id: string;
  title: string;
  status: string;
  createdAt: string;
  variants: { nodes: GqlVariant[] };
}

interface ProductsPage {
  data: {
    products: {
      nodes: GqlProduct[];
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
    };
  };
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

/**
 * Fetch all orders in the given ISO date range and aggregate line items
 * by product+variant. Uses cursor pagination; never loads all orders at once.
 */
export async function fetchOrderAggregations(
  admin: AdminClient,
  startDate: string,
  endDate: string,
): Promise<{ aggregations: LineItemAgg[]; totalOrders: number; totalRevenue: number }> {
  const query = `created_at:>='${startDate}T00:00:00Z' created_at:<='${endDate}T23:59:59Z' financial_status:paid`;
  const aggMap = new Map<string, LineItemAgg>();
  let totalOrders = 0;
  let totalRevenue = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(ORDERS_QUERY, {
      variables: { first: 250, after: cursor, query },
    });
    const json = (await response.json()) as OrdersPage & { errors?: { message: string }[] };
    if (!json.data?.orders) {
      const msg = json.errors?.map((e) => e.message).join("; ") ?? "Unknown GraphQL error";
      throw new Error(`Failed to fetch orders: ${msg}`);
    }
    const page = json.data.orders;

    for (const order of page.nodes) {
      totalOrders++;
      for (const item of order.lineItems.nodes) {
        if (!item.product) continue;

        const productId = item.product.id;
        const variantId = item.variant?.id ?? `${productId}__no_variant`;
        const key = `${productId}__${variantId}`;
        const itemRevenue = parseFloat(item.originalTotalSet.shopMoney.amount) || 0;

        totalRevenue += itemRevenue;

        const existing = aggMap.get(key);
        if (existing) {
          existing.unitsSold += item.quantity;
          existing.revenue += itemRevenue;
        } else {
          aggMap.set(key, {
            productId,
            variantId,
            productTitle: item.product.title,
            variantTitle: item.variant?.title ?? "",
            unitsSold: item.quantity,
            revenue: itemRevenue,
          });
        }
      }
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return { aggregations: Array.from(aggMap.values()), totalOrders, totalRevenue };
}

/**
 * Fetch all products with variants and inventory levels using cursor pagination.
 */
export async function fetchAllProducts(admin: AdminClient): Promise<ShopifyProduct[]> {
  const products: ShopifyProduct[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: 250, after: cursor },
    });
    const json = (await response.json()) as ProductsPage & { errors?: { message: string }[] };
    if (!json.data?.products) {
      const msg = json.errors?.map((e) => e.message).join("; ") ?? "Unknown GraphQL error";
      throw new Error(`Failed to fetch products: ${msg}`);
    }
    const page = json.data.products;

    for (const p of page.nodes) {
      products.push({
        productId: p.id,
        productTitle: p.title,
        status: p.status,
        createdAt: p.createdAt,
        variants: p.variants.nodes.map((v) => ({
          variantId: v.id,
          variantTitle: v.title === "Default Title" ? "" : v.title,
          inventoryQuantity: v.inventoryQuantity ?? 0,
        })),
      });
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return products;
}

/**
 * Fetch orders only for the last 14 days for high-demand / velocity calculation.
 */
export async function fetchLast14DayAggregations(
  admin: AdminClient,
  referenceDate: Date,
): Promise<LineItemAgg[]> {
  const end = referenceDate.toISOString().slice(0, 10);
  const startMs = referenceDate.getTime() - 14 * 24 * 60 * 60 * 1000;
  const start = new Date(startMs).toISOString().slice(0, 10);
  const { aggregations } = await fetchOrderAggregations(admin, start, end);
  return aggregations;
}
