import type { ShopifyProduct, ShopifyArticle, PageInfo } from "../../types/meta-generator";

const PRODUCTS_QUERY = `#graphql
  query FetchProducts($first: Int, $last: Int, $after: String, $before: String, $query: String) {
    products(first: $first, last: $last, after: $after, before: $before, query: $query) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          descriptionHtml
          seo { title description }
          updatedAt
        }
      }
    }
  }
`;

const ARTICLES_QUERY = `#graphql
  query FetchArticles($first: Int, $last: Int, $after: String, $before: String, $query: String) {
    articles(first: $first, last: $last, after: $after, before: $before, query: $query) {
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        node {
          id
          title
          handle
          contentHtml
          seo { title description }
          updatedAt
        }
      }
    }
  }
`;

const PRODUCTS_COUNT_QUERY = `#graphql
  query ProductsCount($query: String) {
    productsCount(query: $query) { count }
  }
`;

const ARTICLES_COUNT_QUERY = `#graphql
  query ArticlesCount($query: String) {
    articlesCount(query: $query) { count }
  }
`;

// Lightweight queries used to tally SEO-completeness stats. Shopify's product
// search syntax does NOT support `seo_title:''` / `seo_description:''` filters,
// so we can't ask the API to count missing-SEO resources directly. Instead we
// page through every resource fetching only `id` + `seo` and tally locally —
// this reflects real, published SEO state immediately after an edit.
// Includes title / handle / updatedAt (still lightweight) so a single full scan
// can drive both the missing-SEO filters AND server-side title/handle search,
// and hydrate the editor table without a second Shopify round-trip per page.
const PRODUCTS_SEO_PAGE_QUERY = `#graphql
  query ProductsSeoPage($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title handle seo { title description } updatedAt } }
    }
  }
`;

const ARTICLES_SEO_PAGE_QUERY = `#graphql
  query ArticlesSeoPage($first: Int!, $after: String) {
    articles(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id title handle seo { title description } updatedAt } }
    }
  }
`;

const NODES_QUERY = `#graphql
  query FetchNodes($ids: [ID!]!) {
    nodes(ids: $ids) {
      ... on Product {
        id
        title
        handle
        descriptionHtml
        seo { title description }
        updatedAt
      }
      ... on Article {
        id
        title
        handle
        contentHtml
        seo { title description }
        updatedAt
      }
    }
  }
`;

const PRODUCT_UPDATE_MUTATION = `#graphql
  mutation ProductUpdateSeo($input: ProductInput!) {
    productUpdate(input: $input) {
      product { id seo { title description } }
      userErrors { field message }
    }
  }
`;

const ARTICLE_UPDATE_MUTATION = `#graphql
  mutation ArticleUpdateSeo($id: ID!, $article: ArticleUpdateInput!) {
    articleUpdate(id: $id, article: $article) {
      article { id seo { title description } }
      userErrors { field message }
    }
  }
`;

const isDev = process.env.NODE_ENV !== "production";
const debugLog = (...args: unknown[]) => {
  if (isDev) console.log("[meta-publish]", ...args);
};

// The SEO payload Shopify confirms it stored, echoed back from the mutation.
export interface PublishedSeo {
  title: string | null;
  description: string | null;
}

export interface PublishResult {
  success: boolean;
  error?: string;
  seo?: PublishedSeo;
}

type AdminGraphQL = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;

export async function fetchProducts(
  admin: { graphql: AdminGraphQL },
  options: {
    first?: number;
    last?: number;
    after?: string | null;
    before?: string | null;
    query?: string | null;
  },
): Promise<{ products: ShopifyProduct[]; pageInfo: PageInfo }> {
  const variables: Record<string, unknown> = {};
  if (options.first) variables.first = options.first;
  if (options.last) variables.last = options.last;
  if (options.after) variables.after = options.after;
  if (options.before) variables.before = options.before;
  if (options.query) variables.query = options.query;
  if (!variables.first && !variables.last) variables.first = 25;

  const response = await admin.graphql(PRODUCTS_QUERY, { variables });
  const json = await response.json() as {
    data: {
      products: {
        pageInfo: PageInfo;
        edges: Array<{ node: ShopifyProduct }>;
      };
    };
  };

  return {
    products: json.data.products.edges.map((e) => e.node),
    pageInfo: json.data.products.pageInfo,
  };
}

export async function fetchArticles(
  admin: { graphql: AdminGraphQL },
  options: {
    first?: number;
    last?: number;
    after?: string | null;
    before?: string | null;
    query?: string | null;
  },
): Promise<{ articles: ShopifyArticle[]; pageInfo: PageInfo }> {
  const variables: Record<string, unknown> = {};
  if (options.first) variables.first = options.first;
  if (options.last) variables.last = options.last;
  if (options.after) variables.after = options.after;
  if (options.before) variables.before = options.before;
  if (options.query) variables.query = options.query;
  if (!variables.first && !variables.last) variables.first = 25;

  const response = await admin.graphql(ARTICLES_QUERY, { variables });
  const json = await response.json() as {
    data: {
      articles: {
        pageInfo: PageInfo;
        edges: Array<{ node: ShopifyArticle }>;
      };
    };
  };

  return {
    articles: json.data.articles.edges.map((e) => e.node),
    pageInfo: json.data.articles.pageInfo,
  };
}

export async function fetchProductsCount(
  admin: { graphql: AdminGraphQL },
  query?: string,
): Promise<number> {
  const response = await admin.graphql(PRODUCTS_COUNT_QUERY, {
    variables: query ? { query } : {},
  });
  const json = await response.json() as { data: { productsCount: { count: number } } };
  return json.data.productsCount.count;
}

export async function fetchArticlesCount(
  admin: { graphql: AdminGraphQL },
  query?: string,
): Promise<number> {
  const response = await admin.graphql(ARTICLES_COUNT_QUERY, {
    variables: query ? { query } : {},
  });
  const json = await response.json() as { data: { articlesCount: { count: number } } };
  return json.data.articlesCount.count;
}

export interface SeoCompletenessStats {
  total: number;
  missingTitle: number;
  missingDescription: number;
  missingBoth: number;
}

// Treat null, undefined, "", and whitespace-only values as "missing". This is
// the single source of truth shared by the dashboard stats and the editor's
// "Missing Title / Missing Description / All Missing" filters so they always
// agree. Exported so the editor loader uses the exact same rule.
export const isSeoEmpty = (value: string | null | undefined): boolean =>
  !value || value.trim() === "";

// Page size capped at 250 (Shopify's max for a connection). A safety cap on
// total pages prevents runaway loops on very large catalogs; if hit, counts
// reflect the pages scanned and `hasNextPage` is logged.
const SEO_PAGE_SIZE = 250;
const SEO_MAX_PAGES = 200; // up to 50k resources

async function computeSeoStats(
  admin: { graphql: AdminGraphQL },
  query: string,
  rootKey: "products" | "articles",
): Promise<SeoCompletenessStats> {
  const stats: SeoCompletenessStats = { total: 0, missingTitle: 0, missingDescription: 0, missingBoth: 0 };
  let after: string | null = null;
  let pages = 0;

  do {
    const response = await admin.graphql(query, {
      variables: { first: SEO_PAGE_SIZE, after },
    });
    const json = await response.json() as {
      data?: Record<string, {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: { id: string; seo: { title: string | null; description: string | null } } }>;
      }>;
    };
    const conn = json.data?.[rootKey];
    if (!conn) break;

    for (const { node } of conn.edges) {
      stats.total += 1;
      const noTitle = isSeoEmpty(node.seo?.title);
      const noDesc = isSeoEmpty(node.seo?.description);
      // INCLUSIVE buckets, matching the editor's filters exactly:
      //   missingTitle       = SEO title empty (regardless of description)
      //   missingDescription = meta description empty (regardless of title)
      //   missingBoth        = both empty
      // A resource missing both is counted in all three, so clicking the
      // "Missing SEO Title" card maps 1:1 to the editor's "Missing Title" filter.
      if (noTitle) stats.missingTitle += 1;
      if (noDesc) stats.missingDescription += 1;
      if (noTitle && noDesc) stats.missingBoth += 1;
    }

    pages += 1;
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    if (after && pages >= SEO_MAX_PAGES) {
      console.warn(`[computeSeoStats] ${rootKey}: hit page cap (${SEO_MAX_PAGES}); counts cover first ${stats.total} only`);
      break;
    }
  } while (after);

  return stats;
}

// Count products by SEO completeness. Buckets are INCLUSIVE and overlapping:
// a product missing both fields is counted under `missingTitle`,
// `missingDescription` AND `missingBoth`, so each card equals the matching
// editor filter ("Missing Title" / "Missing Desc" / "All Missing").
export function computeProductSeoStats(admin: { graphql: AdminGraphQL }): Promise<SeoCompletenessStats> {
  return computeSeoStats(admin, PRODUCTS_SEO_PAGE_QUERY, "products");
}

export function computeArticleSeoStats(admin: { graphql: AdminGraphQL }): Promise<SeoCompletenessStats> {
  return computeSeoStats(admin, ARTICLES_SEO_PAGE_QUERY, "articles");
}

export type MissingSeoKind = "title" | "desc" | "both";

// A lightweight resource node: everything the editor table needs for display
// plus the SEO fields the filters key on. Produced by a single catalog scan so
// missing-SEO filtering, title/handle search, and table hydration all run off
// one pass with no per-page Shopify re-fetch.
export interface SeoLiteNode {
  id: string;
  title: string;
  handle: string;
  seo: { title: string | null; description: string | null };
  updatedAt: string;
}

// Page over the lightweight scan query, invoking `onNode` for every resource.
// Shared by the missing-SEO and "all IDs" scans below. Honours the same page
// cap as the dashboard stats. Returns true if the cap was hit (results partial).
async function scanSeoPages(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
  onNode: (node: SeoLiteNode) => void,
): Promise<boolean> {
  const isArticles = resourceType === "article";
  const query = isArticles ? ARTICLES_SEO_PAGE_QUERY : PRODUCTS_SEO_PAGE_QUERY;
  const rootKey = isArticles ? "articles" : "products";
  let after: string | null = null;
  let pages = 0;

  do {
    const response = await admin.graphql(query, { variables: { first: SEO_PAGE_SIZE, after } });
    const json = await response.json() as {
      data?: Record<string, {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        edges: Array<{ node: SeoLiteNode }>;
      }>;
    };
    const conn = json.data?.[rootKey];
    if (!conn) break;

    for (const { node } of conn.edges) onNode(node);

    pages += 1;
    after = conn.pageInfo.hasNextPage ? conn.pageInfo.endCursor : null;
    if (after && pages >= SEO_MAX_PAGES) {
      console.warn(`[scanSeoPages] ${rootKey}: hit page cap (${SEO_MAX_PAGES}); scan is partial`);
      return true;
    }
  } while (after);

  return false;
}

// Whether a lite node matches a missing-SEO filter. INCLUSIVE semantics:
//   - "title" → SEO title empty (regardless of description)
//   - "desc"  → meta description empty (regardless of SEO title)
//   - "both"  → both empty
// A resource missing both fields therefore matches "title", "desc" AND "both".
// Uses the same `isSeoEmpty` rule (null / undefined / "" / whitespace) as the
// dashboard, so counts and rows always agree.
export function matchesMissingSeo(node: SeoLiteNode, kind: MissingSeoKind): boolean {
  const noTitle = isSeoEmpty(node.seo?.title);
  const noDesc = isSeoEmpty(node.seo?.description);
  if (kind === "both") return noTitle && noDesc;
  if (kind === "title") return noTitle;
  return noDesc;
}

// Scan the whole catalog once and return every resource as a lite node, in
// Shopify's default order. The editor loader runs all of its ID-driven filters
// (missing-SEO, pending, status, search) off this single list. Shopify search
// can't filter on empty SEO fields, so a full scan is the only correct approach.
export async function scanAllSeoNodes(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
): Promise<SeoLiteNode[]> {
  const nodes: SeoLiteNode[] = [];
  await scanSeoPages(admin, resourceType, (node) => nodes.push(node));
  return nodes;
}

// Shopify connections cap `first` at 250 and an over-long `id:.. OR ..` query
// string can be rejected, so by-id fetches are chunked. The old single-query
// form silently truncated / failed once the set grew past one page.
const BY_ID_CHUNK = 100;

// Fetch specific products by their GIDs using the id: filter query.
// Uses the same products query as the "all" path — avoids the nodes query
// which can fail silently for certain API versions or permission configs.
export async function fetchProductsByIds(
  admin: { graphql: AdminGraphQL },
  gids: string[],
): Promise<ShopifyProduct[]> {
  if (gids.length === 0) return [];
  const out: ShopifyProduct[] = [];
  for (let i = 0; i < gids.length; i += BY_ID_CHUNK) {
    const chunk = gids.slice(i, i + BY_ID_CHUNK);
    const numericIds = chunk.map((g) => g.split("/").pop()).filter(Boolean) as string[];
    const query = numericIds.map((id) => `id:${id}`).join(" OR ");
    const { products } = await fetchProducts(admin, { first: chunk.length, query });
    out.push(...products);
  }
  return out;
}

// Fetch specific articles by their GIDs using the id: filter query.
export async function fetchArticlesByIds(
  admin: { graphql: AdminGraphQL },
  gids: string[],
): Promise<ShopifyArticle[]> {
  if (gids.length === 0) return [];
  const out: ShopifyArticle[] = [];
  for (let i = 0; i < gids.length; i += BY_ID_CHUNK) {
    const chunk = gids.slice(i, i + BY_ID_CHUNK);
    const numericIds = chunk.map((g) => g.split("/").pop()).filter(Boolean) as string[];
    const query = numericIds.map((id) => `id:${id}`).join(" OR ");
    const { articles } = await fetchArticles(admin, { first: chunk.length, query });
    out.push(...articles);
  }
  return out;
}

// Resolve a list of handles to their Shopify GIDs (and current SEO) by querying
// `handle:` in chunks. Returns a Map keyed by handle. Used by CSV import to
// match rows to real products/articles — handles that don't resolve are caught
// by the caller and reported as skipped. Never touches Shopify SEO values.
export async function fetchResourcesByHandles(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
  handles: string[],
): Promise<Map<string, { id: string; title: string; handle: string }>> {
  const result = new Map<string, { id: string; title: string; handle: string }>();
  const unique = [...new Set(handles.filter(Boolean))];
  const CHUNK = 25; // keep the OR query string well within limits
  const isArticles = resourceType === "article";

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const query = chunk.map((h) => `handle:${JSON.stringify(h)}`).join(" OR ");
    const items = isArticles
      ? (await fetchArticles(admin, { first: chunk.length, query })).articles
      : (await fetchProducts(admin, { first: chunk.length, query })).products;
    for (const item of items) {
      result.set(item.handle, { id: item.id, title: item.title, handle: item.handle });
    }
  }
  return result;
}

type FetchedNode = {
  id: string;
  title: string;
  handle: string;
  seo: { title: string | null; description: string | null };
  updatedAt: string;
  descriptionHtml?: string;
  contentHtml?: string;
};

export async function fetchNodesByIds(
  admin: { graphql: AdminGraphQL },
  ids: string[],
): Promise<FetchedNode[]> {
  if (ids.length === 0) return [];
  const response = await admin.graphql(NODES_QUERY, { variables: { ids } });
  const json = await response.json() as {
    data?: { nodes?: Array<FetchedNode | null> | null } | null;
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    console.error("[fetchNodesByIds] GraphQL errors:", JSON.stringify(json.errors));
  }
  const nodes = json.data?.nodes;
  if (!nodes) return [];
  return nodes.filter(
    (n): n is FetchedNode =>
      n !== null &&
      n !== undefined &&
      typeof n.id === "string" &&
      n.seo !== null &&
      n.seo !== undefined,
  );
}

// Shared response handler for both SEO update mutations. Surfaces problems at
// EVERY layer so nothing is silently swallowed and we never report success on a
// write Shopify didn't actually make:
//   1. transport (non-2xx HTTP)            → error
//   2. top-level GraphQL `errors`          → error  (was previously a crash)
//   3. mutation `userErrors`               → error
//   4. missing/echoed-back resource        → error
// On success it returns the SEO Shopify echoed back, so the caller can confirm
// the stored values match what was sent.
async function handleSeoMutation(
  response: Response,
  mutationKey: "productUpdate" | "articleUpdate",
  resourceKey: "product" | "article",
  sent: { title: string; description: string },
): Promise<PublishResult> {
  if (!response.ok) {
    return { success: false, error: `Shopify HTTP ${response.status}` };
  }

  const json = (await response.json()) as {
    data?: Record<string, {
      userErrors?: Array<{ field: string[] | null; message: string }>;
      product?: { id: string; seo: PublishedSeo } | null;
      article?: { id: string; seo: PublishedSeo } | null;
    }>;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    const msg = json.errors.map((e) => e.message).join(", ");
    debugLog(`${mutationKey} top-level errors:`, msg);
    return { success: false, error: msg };
  }

  const payload = json.data?.[mutationKey];
  if (!payload) {
    debugLog(`${mutationKey} returned no payload`);
    return { success: false, error: "Shopify returned no response payload" };
  }

  const userErrors = payload.userErrors ?? [];
  if (userErrors.length > 0) {
    const msg = userErrors.map((e) => e.message).join(", ");
    debugLog(`${mutationKey} userErrors:`, msg);
    return { success: false, error: msg };
  }

  const resource = payload[resourceKey];
  if (!resource) {
    return { success: false, error: "Shopify did not return the updated resource" };
  }

  debugLog(`${mutationKey} ok`, resource.id, { sent, stored: resource.seo });
  return { success: true, seo: resource.seo };
}

export async function publishProductSeo(
  admin: { graphql: AdminGraphQL },
  productId: string,
  seoTitle: string,
  seoDescription: string,
): Promise<PublishResult> {
  debugLog("productUpdate →", productId, { seoTitle, seoDescription });
  const response = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
    variables: {
      input: {
        id: productId,
        seo: { title: seoTitle, description: seoDescription },
      },
    },
  });
  return handleSeoMutation(response, "productUpdate", "product", {
    title: seoTitle,
    description: seoDescription,
  });
}

export async function publishArticleSeo(
  admin: { graphql: AdminGraphQL },
  articleId: string,
  seoTitle: string,
  seoDescription: string,
): Promise<PublishResult> {
  debugLog("articleUpdate →", articleId, { seoTitle, seoDescription });
  const response = await admin.graphql(ARTICLE_UPDATE_MUTATION, {
    variables: {
      id: articleId,
      article: { seo: { title: seoTitle, description: seoDescription } },
    },
  });
  return handleSeoMutation(response, "articleUpdate", "article", {
    title: seoTitle,
    description: seoDescription,
  });
}
