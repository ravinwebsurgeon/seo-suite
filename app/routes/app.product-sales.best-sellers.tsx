import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadBestSellers, getDateRange, bestSellersToCsv } from "../services/product-sales/reports.server";
import { buildDateRangeKey } from "../services/product-sales/cache.server";
import { BestSellersTable } from "../components/product-sales/BestSellersTable";
import type { DatePreset } from "../types/product-sales";

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

  const { rows, cachedAt } = await loadBestSellers(admin, shopId, dateRange);

  return { rows, cachedAt, dateRange, rangeKey, preset };
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
    await loadBestSellers(admin, shopId, dateRange, true);
    return null;
  }

  if (intent === "export_csv") {
    const { rows } = await loadBestSellers(admin, shopId, dateRange);
    const csv = bestSellersToCsv(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="best-sellers-${dateRange.startDate}-${dateRange.endDate}.csv"`,
      },
    });
  }

  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function BestSellersRoute() {
  const { rows, cachedAt, dateRange, rangeKey, preset } = useLoaderData<typeof loader>();

  return (
    <s-stack direction="block" gap="base">
      {/* Date range selector */}
      <s-section>
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-text>Date Range:</s-text>
          <s-stack direction="inline" gap="small-200">
            {PRESETS.map((p) => (
              <a key={p.value} href={`/app/product-sales/best-sellers?preset=${p.value}`} style={{ textDecoration: "none" }}>
                <s-button variant={preset === p.value ? "primary" : "secondary"}>{p.label}</s-button>
              </a>
            ))}
          </s-stack>
          <div style={{ marginLeft: "auto" }}>
            <s-text>
              {dateRange.startDate} → {dateRange.endDate} · {rows.length.toLocaleString()} products
            </s-text>
          </div>
        </s-stack>
      </s-section>

      <s-section heading="Best Sellers">
        <BestSellersTable rows={rows} dateRange={rangeKey} cachedAt={cachedAt} />
      </s-section>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
