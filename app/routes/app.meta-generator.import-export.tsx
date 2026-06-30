import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getMetaRecordsByStatus, getMetaRecord, upsertMetaRecord } from "../services/meta-generator/db.server";
import { fetchResourcesByHandles } from "../services/meta-generator/shopify.server";
import { ImportExport } from "../components/meta-generator/ImportExport";
import type { CsvImportRow } from "../types/meta-generator";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const [approved, published] = await Promise.all([
    getMetaRecordsByStatus(shopId, "approved"),
    getMetaRecordsByStatus(shopId, "published"),
  ]);
  return { shopId, approvedCount: approved.length, publishedCount: published.length };
};

// ─── Action ──────────────────────────────────────────────────────────────────

type ActionResult = {
  success: boolean;
  intent: string;
  error?: string;
  importedCount?: number;
  skippedCount?: number;
  invalidCount?: number;
  failedRows?: Array<{ row: number; handle: string; message: string }>;
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  // ── CSV Import ──────────────────────────────────────────────────────────────
  // Matches each row to a REAL Shopify product/article by handle, then stores
  // the title_tag / meta_description as GENERATED values in our DB only. The
  // live Shopify SEO fields are never touched (publishing is a separate step).
  //   - replace      → overwrite existing generated values
  //   - missing_only → keep existing generated values, only fill blanks
  // Reports imported / skipped (no match or skipped by mode) / invalid (failed
  // length validation).
  if (intent === "csv_import") {
    const mode = formData.get("mode") as "replace" | "missing_only";
    const rowsJson = formData.get("rows") as string;

    let rows: CsvImportRow[];
    try {
      rows = JSON.parse(rowsJson) as CsvImportRow[];
    } catch {
      return { success: false, intent, error: "Invalid CSV data" };
    }

    let imported = 0;
    let skipped = 0;
    let invalid = 0;
    const failedRows: Array<{ row: number; handle: string; message: string }> = [];

    // Resolve handles to real Shopify GIDs, grouped by resource type so we use
    // the correct connection (products vs articles).
    const byType: Record<"product" | "article", string[]> = { product: [], article: [] };
    for (const row of rows) {
      const t = row.type === "article" ? "article" : "product";
      byType[t].push(row.handle);
    }
    const [productMap, articleMap] = await Promise.all([
      byType.product.length ? fetchResourcesByHandles(admin, "product", byType.product) : new Map(),
      byType.article.length ? fetchResourcesByHandles(admin, "article", byType.article) : new Map(),
    ]);

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const resourceType = row.type === "article" ? "article" : "product";
      const rowNum = i + 1;

      // Validate lengths (invalid → not imported, reported).
      if (row.title_tag.length > 60) {
        invalid++;
        failedRows.push({ row: rowNum, handle: row.handle, message: `Title too long (${row.title_tag.length}/60)` });
        continue;
      }
      if (row.meta_description.length > 160) {
        invalid++;
        failedRows.push({ row: rowNum, handle: row.handle, message: `Description too long (${row.meta_description.length}/160)` });
        continue;
      }

      // Match to a real Shopify resource by handle.
      const match = (resourceType === "article" ? articleMap : productMap).get(row.handle) as
        | { id: string }
        | undefined;
      if (!match) {
        skipped++;
        failedRows.push({ row: rowNum, handle: row.handle, message: `No ${resourceType} found with this handle` });
        continue;
      }

      try {
        // missing_only: don't clobber values we already generated.
        if (mode === "missing_only") {
          const existing = await getMetaRecord(shopId, match.id);
          if (existing?.generatedTitle || existing?.generatedDescription) {
            skipped++;
            continue;
          }
        }

        await upsertMetaRecord({
          shopId,
          resourceId: match.id,
          resourceType,
          generatedTitle: row.title_tag,
          generatedDescription: row.meta_description,
          status: "generated",
        });
        imported++;
      } catch (err) {
        invalid++;
        failedRows.push({ row: rowNum, handle: row.handle, message: String(err) });
      }
    }

    return { success: true, intent, importedCount: imported, skippedCount: skipped, invalidCount: invalid, failedRows };
  }

  return { success: false, intent: "unknown", error: "Unknown action" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetaImportExport() {
  const { approvedCount, publishedCount } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResult>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { success, intent, error, importedCount, skippedCount, invalidCount } = fetcher.data;
    if (success) {
      if (intent === "csv_import") {
        const parts = [`${importedCount ?? 0} imported`];
        if (skippedCount) parts.push(`${skippedCount} skipped`);
        if (invalidCount) parts.push(`${invalidCount} invalid`);
        shopify.toast.show(parts.join(", "));
      }
    } else {
      shopify.toast.show(error ?? "Something went wrong", { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  return (
    <s-section>
      <ImportExport
        approvedCount={approvedCount}
        publishedCount={publishedCount}
        fetcher={fetcher}
      />
    </s-section>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
