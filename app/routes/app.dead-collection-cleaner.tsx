import { useRef, useCallback, useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import { fetchAllCollections, deleteCollection, createUrlRedirect, addProductToCollection } from "../services/shopify/collections.server";
import { fetchOrphanProducts } from "../services/shopify/products.server";
import { StatCards } from "../components/dead-collection-cleaner/StatCards";
import { CollectionsTable } from "../components/dead-collection-cleaner/CollectionsTable";
import { OrphanProductsTable } from "../components/dead-collection-cleaner/OrphanProductsTable";
import { RedirectModal } from "../components/dead-collection-cleaner/RedirectModal";
import type { RedirectModalHandle } from "../components/dead-collection-cleaner/RedirectModal";
import type { Collection, DashboardStats, OrphanProduct } from "../types/dead-collection-cleaner";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const [rawCollections, orphanProducts] = await Promise.all([
    fetchAllCollections(admin),
    fetchOrphanProducts(admin),
  ]);

  const collections: Collection[] = rawCollections.map((c) => ({
    id: c.id,
    title: c.title,
    handle: c.handle,
    type: c.ruleSet !== null ? "automated" : "manual",
    productsCount: c.productsCount.count,
    updatedAt: c.updatedAt,
    isEmpty: c.productsCount.count === 0,
    isBroken: c.ruleSet !== null && c.productsCount.count === 0,
  }));

  const stats: DashboardStats = {
    totalCollections: collections.length,
    emptyCollections: collections.filter((c) => c.isEmpty).length,
    brokenAutomated: collections.filter((c) => c.isBroken).length,
    orphanProducts: orphanProducts.length,
  };

  return { collections, stats, orphanProducts };
};

// ─── Action ──────────────────────────────────────────────────────────────────

type ActionResponse = { success: boolean; intent: string; error?: string };

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResponse> => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "delete") {
    const ids = formData.getAll("collectionId") as string[];
    const fromPath = formData.get("fromPath") as string | null;
    const toPath = formData.get("toPath") as string | null;

    if (fromPath && toPath) {
      const redirectResult = await createUrlRedirect(admin, fromPath, toPath);
      if (!redirectResult.success) {
        return { success: false, intent, error: redirectResult.error };
      }
    }

    const results = await Promise.all(ids.map((id) => deleteCollection(admin, id)));
    const errors = results.flatMap((r) => r.userErrors);
    if (errors.length > 0) {
      return { success: false, intent, error: errors.map((e) => e.message).join(", ") };
    }
    return { success: true, intent };
  }

  if (intent === "assignCollection") {
    const productId = formData.get("productId") as string;
    const collectionId = formData.get("collectionId") as string;
    const result = await addProductToCollection(admin, collectionId, productId);
    if (!result.success) {
      return { success: false, intent, error: result.error };
    }
    return { success: true, intent };
  }

  return { success: false, intent: "unknown", error: "Unknown action" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function DeadCollectionCleaner() {
  const { collections, stats, orphanProducts } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResponse>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();
  const modalRef = useRef<RedirectModalHandle>(null);

  const isDeleting =
    fetcher.state !== "idle" &&
    (fetcher.formData?.get("_intent") as string) === "delete";

  const isAssigning =
    fetcher.state !== "idle" &&
    (fetcher.formData?.get("_intent") as string) === "assignCollection";

  const revalidatorRef = useRef(revalidator);
  useEffect(() => { revalidatorRef.current = revalidator; });

  // Show toast on action completion
  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      const messages: Record<string, string> = {
        delete: "Collection(s) deleted successfully",
        assignCollection: "Product assigned to collection",
      };
      shopify.toast.show(messages[fetcher.data.intent] ?? "Done");
      revalidatorRef.current.revalidate();
    } else {
      shopify.toast.show(fetcher.data.error ?? "Something went wrong", { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  // Delete single or bulk collections (opens modal first)
  const handleDeleteSelected = useCallback(
    (ids: string[]) => {
      if (ids.length === 1) {
        const collection = collections.find((c) => c.id === ids[0]);
        if (collection) {
          modalRef.current?.openSingle(collection.handle, collection.id);
          return;
        }
      }
      modalRef.current?.openBulk(ids);
    },
    [collections],
  );

  // Called when modal confirms single delete
  const handleConfirmDelete = useCallback(
    (collectionId: string, fromPath: string | null, toPath: string | null) => {
      const formData = new FormData();
      formData.set("_intent", "delete");
      formData.append("collectionId", collectionId);
      if (fromPath) formData.set("fromPath", fromPath);
      if (toPath) formData.set("toPath", toPath);
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  // Called when modal confirms bulk delete
  const handleBulkDelete = useCallback(
    (ids: string[]) => {
      const formData = new FormData();
      formData.set("_intent", "delete");
      ids.forEach((id) => formData.append("collectionId", id));
      fetcher.submit(formData, { method: "POST" });
    },
    [fetcher],
  );

  // Export CSV
  const handleExportCsv = useCallback(
    (ids: string[]) => {
      const selected = collections.filter((c) => ids.includes(c.id));
      const headers = ["ID", "Title", "Handle", "Type", "Products", "Last Updated", "Empty", "Broken"];
      const rows = selected.map((c) => [
        c.id,
        `"${c.title.replace(/"/g, '""')}"`,
        c.handle,
        c.type,
        c.productsCount.toString(),
        c.updatedAt,
        c.isEmpty ? "Yes" : "No",
        c.isBroken ? "Yes" : "No",
      ]);
      const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "dead-collections.csv";
      link.click();
      URL.revokeObjectURL(url);
    },
    [collections],
  );

  // Assign orphan product to collection
  const handleAssignProduct = useCallback(
    (productId: string, collectionId: string) => {
      fetcher.submit(
        { _intent: "assignCollection", productId, collectionId },
        { method: "POST" },
      );
    },
    [fetcher],
  );

  const problemCollections = collections.filter((c) => c.isEmpty || c.isBroken);
  const allCollections = collections;

  return (
    <s-page heading="Dead Collection Cleaner">
      <s-button
        slot="primary-action"
        variant="secondary"
        onClick={() => revalidator.revalidate()}
        {...(revalidator.state === "loading" ? { loading: true } : {})}
      >
        Refresh
      </s-button>

      {/* ── Stats ── */}
      <s-section heading="Overview">
        <StatCards stats={stats} />
      </s-section>

      {/* ── Collections Table ── */}
      <s-section heading="Dead Collections">
        <s-paragraph>
          Collections that are empty or have broken automation rules. Review and delete stale
          collections to keep your store clean.
        </s-paragraph>
        {revalidator.state === "loading" ? (
          <s-stack direction="inline" justifyContent="center" alignItems="center">
            <s-spinner accessibilityLabel="Loading collections" />
          </s-stack>
        ) : (
          <CollectionsTable
            collections={problemCollections}
            onDeleteSelected={handleDeleteSelected}
            onExportCsv={handleExportCsv}
            isDeleting={isDeleting}
          />
        )}
      </s-section>

      {/* ── Orphan Products Table ── */}
      <s-section heading="Orphan Products">
        <s-paragraph>
          Products not assigned to any collection. Use the dropdown to assign them and keep your
          catalog organised.
        </s-paragraph>
        {revalidator.state === "loading" ? (
          <s-stack direction="inline" justifyContent="center" alignItems="center">
            <s-spinner accessibilityLabel="Loading orphan products" />
          </s-stack>
        ) : (
          <OrphanProductsTable
            products={orphanProducts as OrphanProduct[]}
            collections={allCollections}
            onAssign={handleAssignProduct}
            isAssigning={isAssigning}
          />
        )}
      </s-section>

      {/* ── Delete / Redirect Modal ── */}
      <RedirectModal
        ref={modalRef}
        onConfirmDelete={handleConfirmDelete}
        onBulkDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
