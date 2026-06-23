import type { OrphanProduct } from "../../types/dead-collection-cleaner";

const PRODUCTS_WITH_COLLECTIONS_QUERY = `#graphql
  query GetProductsWithCollections($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      nodes {
        id
        title
        status
        collections(first: 1) {
          nodes {
            id
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

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

interface ProductNode {
  id: string;
  title: string;
  status: "ACTIVE" | "DRAFT" | "ARCHIVED";
  collections: {
    nodes: Array<{ id: string }>;
  };
}

interface ProductsPage {
  data: {
    products: {
      nodes: ProductNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export async function fetchOrphanProducts(admin: AdminClient): Promise<OrphanProduct[]> {
  const orphans: OrphanProduct[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(PRODUCTS_WITH_COLLECTIONS_QUERY, {
      variables: { first: 250, after: cursor },
    });
    const json = (await response.json()) as ProductsPage;
    const page = json.data.products;

    for (const product of page.nodes) {
      if (product.collections.nodes.length === 0) {
        orphans.push({
          id: product.id,
          title: product.title,
          status: product.status,
        });
      }
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return orphans;
}
