import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { computeProductSeoStats, computeArticleSeoStats } from "../services/meta-generator/shopify.server";
import { getMetaStatsByShop, getQueueStats } from "../services/meta-generator/db.server";
import { MetaDashboardCards } from "../components/meta-generator/StatCards";
import type { DashboardStats } from "../types/meta-generator";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  const emptyStats = { total: 0, missingTitle: 0, missingDescription: 0, missingBoth: 0 };
  const [productSeo, articleSeo, aiStats, queueStats] = await Promise.all([
    computeProductSeoStats(admin).catch(() => emptyStats),
    computeArticleSeoStats(admin).catch(() => emptyStats),
    getMetaStatsByShop(shopId),
    getQueueStats(shopId),
  ]);

  const stats: DashboardStats = {
    products: {
      total: productSeo.total,
      missingTitle: productSeo.missingTitle,
      missingDescription: productSeo.missingDescription,
      missingBoth: productSeo.missingBoth,
    },
    articles: {
      total: articleSeo.total,
      missingTitle: articleSeo.missingTitle,
      missingDescription: articleSeo.missingDescription,
      missingBoth: articleSeo.missingBoth,
    },
    ai: {
      generated: aiStats.generated,
      pendingApproval: aiStats.pending,
      approved: aiStats.approved,
      published: aiStats.published,
      failed: aiStats.failed,
    },
    queue: queueStats,
  };

  return { stats };
};

export default function MetaDashboard() {
  const { stats } = useLoaderData<typeof loader>();
  const revalidator = useRevalidator();

  return (
    <>
      <s-section>
        <s-stack direction="inline" justifyContent="end">
          <s-button
            variant="secondary"
            onClick={() => revalidator.revalidate()}
            {...(revalidator.state === "loading" ? { loading: true } : {})}
          >
            Refresh
          </s-button>
        </s-stack>
      </s-section>

      <MetaDashboardCards stats={stats} />
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
