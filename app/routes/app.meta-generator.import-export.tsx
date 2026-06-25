import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getMetaRecordsByStatus } from "../services/meta-generator/db.server";
import { publishProductSeo, publishArticleSeo } from "../services/meta-generator/shopify.server";
import { upsertMetaRecord } from "../services/meta-generator/db.server";
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
  failedRows?: Array<{ row: number; handle: string; message: string }>;
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  // ── CSV Import ────────────────────────────────────────────────────────────
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
    const failedRows: Array<{ row: number; handle: string; message: string }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Validate lengths
        if (row.title_tag.length > 60) {
          failedRows.push({ row: i + 1, handle: row.handle, message: `Title too long (${row.title_tag.length}/60)` });
          continue;
        }
        if (row.meta_description.length > 160) {
          failedRows.push({ row: i + 1, handle: row.handle, message: `Description too long (${row.meta_description.length}/160)` });
          continue;
        }

        const resourceType = row.type ?? "product";
        // Use handle as resourceId for lookup — in a real integration you'd look up by handle
        const resourceId = `${resourceType}:${row.handle}`;

        await upsertMetaRecord({
          shopId,
          resourceId,
          resourceType,
          generatedTitle: row.title_tag,
          generatedDescription: row.meta_description,
          status: mode === "replace" ? "approved" : "generated",
        });
        imported++;
      } catch (err) {
        failedRows.push({ row: i + 1, handle: row.handle, message: String(err) });
      }
    }

    return { success: true, intent, importedCount: imported, failedRows };
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
    const { success, intent, error, importedCount, failedRows } = fetcher.data;
    if (success) {
      if (intent === "csv_import") {
        const failCount = failedRows?.length ?? 0;
        shopify.toast.show(
          `Imported ${importedCount} rows${failCount > 0 ? `, ${failCount} failed` : ""}`,
          failCount > 0 ? { isError: false } : {},
        );
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
