import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadHighDemand } from "../services/product-sales/reports.server";
import { HighDemandTable } from "../components/product-sales/HighDemandTable";
import { PcdPermissionEmptyState } from "../components/product-sales/PcdPermissionEmptyState";
import { PCDPermissionError } from "../types/product-sales";
import type { HighDemandRow, PcdPermissionError } from "../types/product-sales";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  try {
    const { rows, cachedAt } = await loadHighDemand(admin, shopId);
    return { rows, cachedAt, pcdError: null as PcdPermissionError | null };
  } catch (err) {
    if (PCDPermissionError.is(err)) {
      return {
        rows: null as HighDemandRow[] | null,
        cachedAt: null as string | null,
        pcdError: {
          success: false,
          errorType: "PCD_PERMISSION_REQUIRED",
          message: err instanceof Error ? err.message : "Order access not approved.",
        } satisfies PcdPermissionError,
      };
    }
    throw err;
  }
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "refresh") {
    try {
      await loadHighDemand(admin, shopId, true);
    } catch (err) {
      if (PCDPermissionError.is(err)) {
        return { success: false, errorType: "PCD_PERMISSION_REQUIRED", message: err instanceof Error ? err.message : "Order access not approved." } satisfies PcdPermissionError;
      }
      throw err;
    }
    return null;
  }

  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HighDemandRoute() {
  const { rows, cachedAt, pcdError } = useLoaderData<typeof loader>();

  if (pcdError) {
    return <PcdPermissionEmptyState />;
  }

  if (!rows || !cachedAt) return null;

  return (
    <s-stack direction="block" gap="base">
      <s-section>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type="clock" />
          <s-text>
            Always shows data for the <strong>last 14 days</strong> — not affected by the date range filter.
            Velocity threshold: &gt; 0.5
          </s-text>
          <div style={{ marginLeft: "auto" }}>
            <s-text>{rows.length.toLocaleString()} products flagged</s-text>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="High Demand / Low Stock">
        <HighDemandTable rows={rows} cachedAt={cachedAt} />
      </s-section>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
