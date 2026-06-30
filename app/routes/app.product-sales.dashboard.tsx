import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { buildReport, getDateRange } from "../services/product-sales/reports.server";
import { SummaryCards } from "../components/product-sales/SummaryCards";
import { PcdPermissionEmptyState } from "../components/product-sales/PcdPermissionEmptyState";
import { PCDPermissionError } from "../types/product-sales";
import type { DatePreset, ReportResult, PcdPermissionError } from "../types/product-sales";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const url = new URL(request.url);

  const preset = (url.searchParams.get("preset") ?? "30d") as DatePreset;
  const customStart = url.searchParams.get("start") ?? undefined;
  const customEnd = url.searchParams.get("end") ?? undefined;
  const dateRange = getDateRange(preset, customStart, customEnd);

  try {
    const report = await buildReport(admin, shopId, dateRange);
    return { report, preset, pcdError: null as PcdPermissionError | null };
  } catch (err) {
    if (PCDPermissionError.is(err)) {
      return {
        report: null as ReportResult | null,
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

// ─── Action (Refresh) ─────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const preset = (formData.get("preset") ?? "30d") as DatePreset;
  const customStart = formData.get("start") as string | undefined;
  const customEnd = formData.get("end") as string | undefined;
  const dateRange = getDateRange(preset, customStart ?? undefined, customEnd ?? undefined);

  try {
    await buildReport(admin, shopId, dateRange, true);
  } catch (err) {
    if (PCDPermissionError.is(err)) {
      return {
        success: false,
        errorType: "PCD_PERMISSION_REQUIRED",
        message: err instanceof Error ? err.message : "Order access not approved.",
      } satisfies PcdPermissionError;
    }
    throw err;
  }
  return null;
};

// ─── Date range bar ───────────────────────────────────────────────────────────

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
];

function DateRangeBar({ preset, report }: { preset: DatePreset; report: ReportResult }) {
  const revalidator = useRevalidator();

  return (
    <s-section>
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text>Date Range:</s-text>
        <s-stack direction="inline" gap="small-200">
          {PRESETS.map((p) => (
            <Link key={p.value} to={`/app/product-sales/dashboard?preset=${p.value}`} style={{ textDecoration: "none" }}>
              <s-button variant={preset === p.value ? "primary" : "secondary"}>{p.label}</s-button>
            </Link>
          ))}
        </s-stack>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
          <s-text>
            {report.dateRange.startDate} → {report.dateRange.endDate}
          </s-text>
          <s-button
            variant="secondary"
            onClick={() => revalidator.revalidate()}
            {...(revalidator.state === "loading" ? { loading: true } : {})}
          >
            Refresh
          </s-button>
        </div>
      </s-stack>
    </s-section>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ProductSalesDashboard() {
  const { report, preset, pcdError } = useLoaderData<typeof loader>();

  if (pcdError) {
    return <PcdPermissionEmptyState />;
  }

  if (!report) return null;

  return (
    <s-stack direction="block" gap="base">
      <DateRangeBar preset={preset} report={report} />
      <SummaryCards summary={report.summary} />

      <s-section heading="Quick Actions">
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          <s-grid-item>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-icon type="star" />
                  <s-heading>Best Sellers</s-heading>
                </s-stack>
                <s-text>
                  View your top {report.summary.bestSellerCount.toLocaleString()} selling products ranked by units sold.
                </s-text>
                <Link to={`/app/product-sales/best-sellers?preset=${preset}`} style={{ textDecoration: "none" }}>
                  <s-button variant="primary">View Best Sellers →</s-button>
                </Link>
              </s-stack>
            </s-box>
          </s-grid-item>
          <s-grid-item>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-icon type="alert-circle" />
                  <s-heading>Zero Sales</s-heading>
                </s-stack>
                <s-text>
                  {report.summary.zeroSaleCount.toLocaleString()} products with no sales. Review for discounts or archival.
                </s-text>
                <Link to={`/app/product-sales/zero-sales?preset=${preset}`} style={{ textDecoration: "none" }}>
                  <s-button variant="secondary">View Zero Sales →</s-button>
                </Link>
              </s-stack>
            </s-box>
          </s-grid-item>
          <s-grid-item>
            <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
              <s-stack direction="block" gap="small">
                <s-stack direction="inline" gap="small" alignItems="center">
                  <s-icon type="alert-diamond" />
                  <s-heading>High Demand</s-heading>
                </s-stack>
                <s-text>
                  {report.summary.highDemandCount.toLocaleString()} products at risk of selling out. Restock now.
                </s-text>
                <Link to="/app/product-sales/high-demand" style={{ textDecoration: "none" }}>
                  <s-button variant="secondary">View High Demand →</s-button>
                </Link>
              </s-stack>
            </s-box>
          </s-grid-item>
        </s-grid>
      </s-section>
    </s-stack>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
