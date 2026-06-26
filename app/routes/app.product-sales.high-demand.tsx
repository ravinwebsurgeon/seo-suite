import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { loadHighDemand, highDemandToCsv } from "../services/product-sales/reports.server";
import { HighDemandTable } from "../components/product-sales/HighDemandTable";

// ─── Loader ───────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  const { rows, cachedAt } = await loadHighDemand(admin, shopId);

  return { rows, cachedAt };
};

// ─── Action ───────────────────────────────────────────────────────────────────

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  if (intent === "refresh") {
    await loadHighDemand(admin, shopId, true);
    return null;
  }

  if (intent === "export_csv") {
    const { rows } = await loadHighDemand(admin, shopId);
    const csv = highDemandToCsv(rows);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="high-demand-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return null;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HighDemandRoute() {
  const { rows, cachedAt } = useLoaderData<typeof loader>();

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
