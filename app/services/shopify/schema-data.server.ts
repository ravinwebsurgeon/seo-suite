import type { ShopifyProduct, ShopifyArticle } from "../../types/schema-builder";

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

const PRODUCTS_QUERY = `#graphql
  query GetProductsForSchema($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active") {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        onlineStoreUrl
        featuredImage {
          url
        }
        priceRange {
          minVariantPrice {
            amount
            currencyCode
          }
        }
      }
    }
  }
`;

const ARTICLES_QUERY = `#graphql
  query GetArticlesForSchema($first: Int!, $after: String) {
    articles(first: $first, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        publishedAt
        blog {
          handle
        }
      }
    }
  }
`;

const SHOP_QUERY = `#graphql
  query GetShopForSchema {
    shop {
      primaryDomain {
        url
      }
    }
  }
`;

interface ProductsResponse {
  data: {
    products: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ShopifyProduct[];
    };
  };
}

interface ArticlesResponse {
  data: {
    articles: {
      pageInfo: { hasNextPage: boolean; endCursor: string | null };
      nodes: ShopifyArticle[];
    };
  };
}

interface ShopResponse {
  data: { shop: { primaryDomain: { url: string } } };
}

export async function fetchProductsForSchema(admin: AdminClient): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  let cursor: string | null = null;

  do {
    const response = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: 250, after: cursor },
    });
    const json = (await response.json()) as ProductsResponse;
    const { nodes, pageInfo } = json.data.products;
    all.push(...nodes);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor !== null);

  return all;
}

export async function fetchArticlesForSchema(admin: AdminClient): Promise<ShopifyArticle[]> {
  const all: ShopifyArticle[] = [];
  let cursor: string | null = null;

  do {
    const response = await admin.graphql(ARTICLES_QUERY, {
      variables: { first: 250, after: cursor },
    });
    const json = (await response.json()) as ArticlesResponse;
    const { nodes, pageInfo } = json.data.articles;
    all.push(...nodes);
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor !== null);

  return all;
}

export async function fetchShopDomain(admin: AdminClient): Promise<string> {
  const response = await admin.graphql(SHOP_QUERY);
  const json = (await response.json()) as ShopResponse;
  return json.data.shop.primaryDomain.url;
}
