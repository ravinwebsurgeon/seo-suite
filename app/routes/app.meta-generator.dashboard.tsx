import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { fetchProductsCount, fetchArticlesCount } from "../services/meta-generator/shopify.server";
import { getMetaStatsByShop, getQueueStats } from "../services/meta-generator/db.server";
import { MetaDashboardCards } from "../components/meta-generator/StatCards";
import type { DashboardStats } from "../types/meta-generator";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  const [
    totalProducts,
    missingTitleProducts,
    missingDescProducts,
    missingBothProducts,
    totalArticles,
    missingTitleArticles,
    missingDescArticles,
    missingBothArticles,
    aiStats,
    queueStats,
  ] = await Promise.all([
    fetchProductsCount(admin).catch(() => 0),
    fetchProductsCount(admin, "seo_title:'' NOT seo_description:''").catch(() => 0),
    fetchProductsCount(admin, "NOT seo_title:'' seo_description:''").catch(() => 0),
    fetchProductsCount(admin, "seo_title:'' seo_description:''").catch(() => 0),
    fetchArticlesCount(admin).catch(() => 0),
    fetchArticlesCount(admin, "seo_title:''").catch(() => 0),
    fetchArticlesCount(admin, "seo_description:''").catch(() => 0),
    fetchArticlesCount(admin, "seo_title:'' seo_description:''").catch(() => 0),
    getMetaStatsByShop(shopId),
    getQueueStats(shopId),
  ]);

  const stats: DashboardStats = {
    products: {
      total: totalProducts,
      missingTitle: missingTitleProducts,
      missingDescription: missingDescProducts,
      missingBoth: missingBothProducts,
    },
    articles: {
      total: totalArticles,
      missingTitle: missingTitleArticles,
      missingDescription: missingDescArticles,
      missingBoth: missingBothArticles,
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
