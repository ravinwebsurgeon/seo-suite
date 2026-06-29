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
const PRODUCTS_SEO_PAGE_QUERY = `#graphql
  query ProductsSeoPage($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id seo { title description } } }
    }
  }
`;

const ARTICLES_SEO_PAGE_QUERY = `#graphql
  query ArticlesSeoPage($first: Int!, $after: String) {
    articles(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges { node { id seo { title description } } }
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

// Treat null, "", and whitespace-only values as "missing" — mirrors the
// editor's `!r.currentSeoTitle` filtering so the dashboard agrees with it.
const isSeoEmpty = (value: string | null | undefined): boolean => !value || value.trim() === "";

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
      // Mutually-exclusive buckets, matching the editor's filters: a product
      // missing both fields is counted ONLY in missingBoth. So `missingTitle` ==
      // the editor's "Missing Title" filter (title empty, description present),
      // `missingDescription` likewise, and they never double-count.
      if (noTitle && noDesc) stats.missingBoth += 1;
      else if (noTitle) stats.missingTitle += 1;
      else if (noDesc) stats.missingDescription += 1;
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

// Count products by SEO completeness. Buckets are mutually exclusive: a product
// missing both fields counts only toward `missingBoth`, so `missingTitle` /
// `missingDescription` / `missingBoth` never overlap and each card equals the
// matching editor filter ("Missing Title" / "Missing Desc" / "Missing Both").
export function computeProductSeoStats(admin: { graphql: AdminGraphQL }): Promise<SeoCompletenessStats> {
  return computeSeoStats(admin, PRODUCTS_SEO_PAGE_QUERY, "products");
}

export function computeArticleSeoStats(admin: { graphql: AdminGraphQL }): Promise<SeoCompletenessStats> {
  return computeSeoStats(admin, ARTICLES_SEO_PAGE_QUERY, "articles");
}

export type MissingSeoKind = "title" | "desc" | "both";

// Page over the id+seo query, invoking `onNode` for every resource. Shared by
// the missing-SEO and "all IDs" scans below. Honours the same page cap as the
// dashboard stats. Returns true if the cap was hit (results are partial).
async function scanSeoPages(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
  onNode: (node: { id: string; seo: { title: string | null; description: string | null } }) => void,
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
        edges: Array<{ node: { id: string; seo: { title: string | null; description: string | null } } }>;
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

// Scan the whole catalog and return the GIDs whose SEO is missing per `kind`.
// Buckets are MUTUALLY EXCLUSIVE so each product appears under exactly one
// filter:
//   - "title" → SEO title empty but description present
//   - "desc"  → description empty but SEO title present
//   - "both"  → both empty
// A product missing both fields belongs to "both" only — it is NOT listed under
// "title" or "desc". Uses the same `isSeoEmpty` rule (null / "" / whitespace) as
// the dashboard. Shopify search can't filter on empty SEO fields, so a full scan
// is the only correct approach.
export async function fetchResourceIdsMissingSeo(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
  kind: MissingSeoKind,
): Promise<string[]> {
  const ids: string[] = [];
  await scanSeoPages(admin, resourceType, (node) => {
    const noTitle = isSeoEmpty(node.seo?.title);
    const noDesc = isSeoEmpty(node.seo?.description);
    const match =
      kind === "both"
        ? noTitle && noDesc
        : kind === "title"
          ? noTitle && !noDesc
          : !noTitle && noDesc;
    if (match) ids.push(node.id);
  });
  return ids;
}

// Scan the whole catalog and return every resource GID, in Shopify's default
// order. Used to resolve the "Pending" filter (= resources not in any acted
// status), which can't come from the DB alone because untracked resources have
// no row yet.
export async function fetchAllResourceIds(
  admin: { graphql: AdminGraphQL },
  resourceType: "product" | "article",
): Promise<string[]> {
  const ids: string[] = [];
  await scanSeoPages(admin, resourceType, (node) => ids.push(node.id));
  return ids;
}

// Fetch specific products by their GIDs using the id: filter query.
// Uses the same products query as the "all" path — avoids the nodes query
// which can fail silently for certain API versions or permission configs.
export async function fetchProductsByIds(
  admin: { graphql: AdminGraphQL },
  gids: string[],
): Promise<ShopifyProduct[]> {
  if (gids.length === 0) return [];
  const numericIds = gids.map((g) => g.split("/").pop()).filter(Boolean) as string[];
  const query = numericIds.map((id) => `id:${id}`).join(" OR ");
  const { products } = await fetchProducts(admin, { first: gids.length, query });
  return products;
}

// Fetch specific articles by their GIDs using the id: filter query.
export async function fetchArticlesByIds(
  admin: { graphql: AdminGraphQL },
  gids: string[],
): Promise<ShopifyArticle[]> {
  if (gids.length === 0) return [];
  const numericIds = gids.map((g) => g.split("/").pop()).filter(Boolean) as string[];
  const query = numericIds.map((id) => `id:${id}`).join(" OR ");
  const { articles } = await fetchArticles(admin, { first: gids.length, query });
  return articles;
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

export async function publishProductSeo(
  admin: { graphql: AdminGraphQL },
  productId: string,
  seoTitle: string,
  seoDescription: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await admin.graphql(PRODUCT_UPDATE_MUTATION, {
    variables: {
      input: {
        id: productId,
        seo: { title: seoTitle, description: seoDescription },
      },
    },
  });
  const json = await response.json() as {
    data: {
      productUpdate: {
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };

  const errors = json.data.productUpdate.userErrors;
  if (errors.length > 0) {
    return { success: false, error: errors.map((e) => e.message).join(", ") };
  }
  return { success: true };
}

export async function publishArticleSeo(
  admin: { graphql: AdminGraphQL },
  articleId: string,
  seoTitle: string,
  seoDescription: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await admin.graphql(ARTICLE_UPDATE_MUTATION, {
    variables: {
      id: articleId,
      article: { seo: { title: seoTitle, description: seoDescription } },
    },
  });
  const json = await response.json() as {
    data: {
      articleUpdate: {
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };

  const errors = json.data.articleUpdate.userErrors;
  if (errors.length > 0) {
    return { success: false, error: errors.map((e) => e.message).join(", ") };
  }
  return { success: true };
}
