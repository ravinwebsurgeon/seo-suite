import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadBestSellers, getDateRange } from "../services/product-sales/reports.server";
import { buildDateRangeKey } from "../services/product-sales/cache.server";
import { BestSellersTable } from "../components/product-sales/BestSellersTable";
import { useSalesAutoRefresh } from "../components/product-sales/useSalesAutoRefresh";
import { PcdPermissionEmptyState } from "../components/product-sales/PcdPermissionEmptyState";
import { PCDPermissionError } from "../types/product-sales";
import type { DatePreset, BestSellerRow, PcdPermissionError } from "../types/product-sales";

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const url = new URL(request.url);

  const preset = (url.searchParams.get("preset") ?? "30d") as DatePreset;
  const customStart = url.searchParams.get("start") ?? undefined;
  const customEnd = url.searchParams.get("end") ?? undefined;
  const dateRange = getDateRange(preset, customStart, customEnd);
  const rangeKey = buildDateRangeKey(dateRange.startDate, dateRange.endDate);

  try {
    const { rows, cachedAt } = await loadBestSellers(admin, shopId, dateRange);
    return { rows, cachedAt, dateRange, rangeKey, preset, pcdError: null as PcdPermissionError | null };
  } catch (err) {
    if (PCDPermissionError.is(err)) {
      return {
        rows: null as BestSellerRow[] | null,
        cachedAt: null as string | null,
        dateRange,
        rangeKey,
        preset,
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
  const preset = (formData.get("preset") ?? "30d") as DatePreset;
  const dateRange = getDateRange(preset);

  if (intent === "refresh") {
    try {
      await loadBestSellers(admin, shopId, dateRange, true);
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

export default function BestSellersRoute() {
  const { rows, cachedAt, dateRange, rangeKey, preset, pcdError } = useLoaderData<typeof loader>();
  const autoRefreshing = useSalesAutoRefresh(cachedAt, { preset });

  if (pcdError) {
    return <PcdPermissionEmptyState />;
  }

  if (!rows || !cachedAt) return null;

  return (
    <s-stack direction="block" gap="base">
      {/* Date range selector */}
      <s-section>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-text>Date Range:</s-text>
          <s-stack direction="inline" gap="small-200">
            {PRESETS.map((p) => (
              <Link key={p.value} to={`/app/product-sales/best-sellers?preset=${p.value}`} style={{ textDecoration: "none" }}>
                <s-button variant={preset === p.value ? "primary" : "secondary"}>{p.label}</s-button>
              </Link>
            ))}
          </s-stack>
          <div style={{ marginLeft: "auto" }}>
            <s-text>
              {autoRefreshing ? "Updating latest data… · " : ""}
              {dateRange.startDate} → {dateRange.endDate} · {rows.length.toLocaleString()} products
            </s-text>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Best Sellers">
        <BestSellersTable rows={rows} dateRange={rangeKey} preset={preset} cachedAt={cachedAt} />
      </s-section>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
