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
