import type { CollectionNode, DeleteResult } from "../../types/dead-collection-cleaner";
import { runWithRateLimit } from "./rate-limit.server";

// Shopify Admin API rate limit for bulk collection deletes (requests/second).
const DELETE_RATE_PER_SECOND = 2;

const COLLECTIONS_QUERY = `#graphql
  query GetCollections($first: Int!, $after: String) {
    collections(first: $first, after: $after) {
      nodes {
        id
        title
        handle
        productsCount {
          count
        }
        ruleSet {
          rules {
            column
            condition
            relation
          }
        }
        updatedAt
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

const DELETE_COLLECTION_MUTATION = `#graphql
  mutation CollectionDelete($input: CollectionDeleteInput!) {
    collectionDelete(input: $input) {
      deletedCollectionId
      userErrors {
        field
        message
      }
    }
  }
`;

const CREATE_REDIRECT_MUTATION = `#graphql
  mutation UrlRedirectCreate($urlRedirect: UrlRedirectInput!) {
    urlRedirectCreate(urlRedirect: $urlRedirect) {
      urlRedirect {
        id
        path
        target
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ADD_PRODUCTS_TO_COLLECTION_MUTATION = `#graphql
  mutation CollectionAddProducts($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

type AdminClient = {
  graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;
};

interface CollectionsPage {
  data: {
    collections: {
      nodes: CollectionNode[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

export async function fetchAllCollections(admin: AdminClient): Promise<CollectionNode[]> {
  const allCollections: CollectionNode[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await admin.graphql(COLLECTIONS_QUERY, {
      variables: { first: 250, after: cursor },
    });
    const json = (await response.json()) as CollectionsPage;
    const page = json.data.collections;

    allCollections.push(...page.nodes);
    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.pageInfo.endCursor;
  }

  return allCollections;
}

export async function deleteCollection(
  admin: AdminClient,
  collectionId: string,
): Promise<DeleteResult> {
  const response = await admin.graphql(DELETE_COLLECTION_MUTATION, {
    variables: { input: { id: collectionId } },
  });
  const json = (await response.json()) as {
    data: { collectionDelete: DeleteResult };
  };
  return json.data.collectionDelete;
}

export interface BulkDeleteResult {
  deletedCount: number;
  userErrors: Array<{ field: string[] | null; message: string }>;
}

/**
 * Deletes multiple collections while respecting Shopify's Admin API rate limit.
 *
 * Deletes are dispatched through a queue capped at {@link DELETE_RATE_PER_SECOND}
 * requests/second to avoid `THROTTLED` errors on large selections. Failures on
 * individual collections (GraphQL userErrors or thrown network/API errors) are
 * collected rather than aborting the whole batch, so a partial success still
 * removes everything it can.
 */
export async function bulkDeleteCollections(
  admin: AdminClient,
  collectionIds: string[],
): Promise<BulkDeleteResult> {
  const settled = await runWithRateLimit(
    collectionIds.map((id) => () => deleteCollection(admin, id)),
    DELETE_RATE_PER_SECOND,
  );

  const userErrors: BulkDeleteResult["userErrors"] = [];
  let deletedCount = 0;

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      const errors = result.value.userErrors;
      if (errors.length > 0) {
        userErrors.push(...errors);
      } else {
        deletedCount += 1;
      }
    } else {
      const message =
        result.reason instanceof Error ? result.reason.message : "Failed to delete collection";
      userErrors.push({ field: ["id"], message: `${collectionIds[index]}: ${message}` });
    }
  });

  return { deletedCount, userErrors };
}

export async function createUrlRedirect(
  admin: AdminClient,
  fromPath: string,
  target: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await admin.graphql(CREATE_REDIRECT_MUTATION, {
      variables: { urlRedirect: { path: fromPath, target } },
    });
    const json = (await response.json()) as {
      data: {
        urlRedirectCreate: {
          urlRedirect: { id: string; path: string; target: string } | null;
          userErrors: Array<{ field: string[]; message: string }>;
        };
      };
    };
    const result = json.data.urlRedirectCreate;
    if (result.userErrors.length > 0) {
      return { success: false, error: result.userErrors.map((e) => e.message).join(", ") };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create URL redirect";
    // Surface access-scope errors with a clear merchant-facing message
    if (message.includes("write_online_store_navigation")) {
      return {
        success: false,
        error:
          "This app does not have permission to create URL redirects. Re-install the app to grant the required access scope.",
      };
    }
    return { success: false, error: message };
  }
}

export async function addProductToCollection(
  admin: AdminClient,
  collectionId: string,
  productId: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await admin.graphql(ADD_PRODUCTS_TO_COLLECTION_MUTATION, {
    variables: { id: collectionId, productIds: [productId] },
  });
  const json = (await response.json()) as {
    data: {
      collectionAddProducts: {
        collection: { id: string } | null;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
  };
  const result = json.data.collectionAddProducts;
  if (result.userErrors.length > 0) {
    return { success: false, error: result.userErrors.map((e) => e.message).join(", ") };
  }
  return { success: true };
}
