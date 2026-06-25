import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import {
  fetchProducts,
  fetchArticles,
  publishProductSeo,
  publishArticleSeo,
} from "../services/meta-generator/shopify.server";
import {
  upsertKeyword,
  getKeywordsForIds,
  getMetaRecordsForIds,
  upsertMetaRecord,
  updateMetaStatus,
  bulkUpdateMetaStatus,
} from "../services/meta-generator/db.server";
import { generateMeta } from "../services/meta-generator/claude.server";
import { enqueueMetaJob } from "../services/meta-generator/queue.server";
import { createJob } from "../services/meta-generator/db.server";
import { MetaTable } from "../components/meta-generator/MetaTable";
import type {
  MetaRecord,
  FilterValue,
  ResourceFilter,
  Tone,
  MetaStatus,
} from "../types/meta-generator";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const url = new URL(request.url);

  const resourceFilter = (url.searchParams.get("resource") ?? "products") as ResourceFilter;
  const filter = (url.searchParams.get("filter") ?? "all") as FilterValue;
  const search = url.searchParams.get("search") ?? "";
  const tone = (url.searchParams.get("tone") ?? "professional") as Tone;
  const after = url.searchParams.get("after") ?? null;
  const before = url.searchParams.get("before") ?? null;
  const PAGE_SIZE = 25;

  let records: MetaRecord[] = [];
  let pageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null as string | null, endCursor: null as string | null };

  const isArticles = resourceFilter === "articles";
  const shopifyQuery = search ? `title:${search}*` : undefined;

  try {
    if (!isArticles) {
      const { products, pageInfo: pi } = await fetchProducts(admin, {
        first: before ? undefined : PAGE_SIZE,
        last: before ? PAGE_SIZE : undefined,
        after: after ?? undefined,
        before: before ?? undefined,
        query: shopifyQuery ?? undefined,
      });
      pageInfo = pi;

      const ids = products.map((p) => p.id);
      const [keywordMap, metaRows] = await Promise.all([
        getKeywordsForIds(shopId, ids),
        getMetaRecordsForIds(shopId, ids),
      ]);
      const metaMap = new Map(metaRows.map((r) => [r.resourceId, r]));

      records = products.map((p) => {
        const meta = metaMap.get(p.id);
        return {
          resourceId: p.id,
          resourceType: "product" as const,
          title: p.title,
          handle: p.handle,
          currentSeoTitle: p.seo.title,
          currentSeoDescription: p.seo.description,
          keyword: keywordMap.get(p.id) ?? null,
          generatedTitle: meta?.generatedTitle ?? null,
          generatedDescription: meta?.generatedDescription ?? null,
          tone: (meta?.tone ?? tone) as Tone,
          status: (meta?.status ?? "pending") as MetaStatus,
          dbId: meta?.id ?? null,
          updatedAt: p.updatedAt,
        };
      });
    } else {
      const { articles, pageInfo: pi } = await fetchArticles(admin, {
        first: before ? undefined : PAGE_SIZE,
        last: before ? PAGE_SIZE : undefined,
        after: after ?? undefined,
        before: before ?? undefined,
        query: shopifyQuery ?? undefined,
      });
      pageInfo = pi;

      const ids = articles.map((a) => a.id);
      const [keywordMap, metaRows] = await Promise.all([
        getKeywordsForIds(shopId, ids),
        getMetaRecordsForIds(shopId, ids),
      ]);
      const metaMap = new Map(metaRows.map((r) => [r.resourceId, r]));

      records = articles.map((a) => {
        const meta = metaMap.get(a.id);
        return {
          resourceId: a.id,
          resourceType: "article" as const,
          title: a.title,
          handle: a.handle,
          currentSeoTitle: a.seo.title,
          currentSeoDescription: a.seo.description,
          keyword: keywordMap.get(a.id) ?? null,
          generatedTitle: meta?.generatedTitle ?? null,
          generatedDescription: meta?.generatedDescription ?? null,
          tone: (meta?.tone ?? tone) as Tone,
          status: (meta?.status ?? "pending") as MetaStatus,
          dbId: meta?.id ?? null,
          updatedAt: a.updatedAt,
        };
      });
    }

    // Client-side filter by status/SEO
    if (filter !== "all") {
      records = records.filter((r) => {
        if (filter === "missing_title") return !r.currentSeoTitle;
        if (filter === "missing_desc") return !r.currentSeoDescription;
        if (filter === "missing_both") return !r.currentSeoTitle && !r.currentSeoDescription;
        if (filter === "generated") return r.status === "generated";
        if (filter === "approved") return r.status === "approved";
        if (filter === "published") return r.status === "published";
        if (filter === "failed") return r.status === "failed";
        return true;
      });
    }
  } catch (err) {
    console.error("[editor loader]", err);
  }

  return { records, pageInfo, filter, resourceFilter, search, tone };
};

// ─── Action ──────────────────────────────────────────────────────────────────

type ActionResult = {
  success: boolean;
  intent: string;
  error?: string;
  generated?: { title: string; description: string };
};

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;

  // ── Save keyword ──────────────────────────────────────────────────────────
  if (intent === "save_keyword") {
    const resourceId = formData.get("resourceId") as string;
    const resourceType = formData.get("resourceType") as "product" | "article";
    const keyword = (formData.get("keyword") as string).trim();
    await upsertKeyword(shopId, resourceId, resourceType, keyword);
    return { success: true, intent };
  }

  // ── Generate single ───────────────────────────────────────────────────────
  if (intent === "generate" || intent === "regenerate") {
    const resourceId = formData.get("resourceId") as string;
    const resourceType = formData.get("resourceType") as "product" | "article";
    const title = formData.get("title") as string;
    const contentHtml = formData.get("contentHtml") as string;
    const keyword = formData.get("keyword") as string | null;
    const tone = (formData.get("tone") as Tone) ?? "professional";

    try {
      const generated = await generateMeta({
        title,
        contentHtml: contentHtml ?? "",
        keyword,
        tone,
        resourceType,
      });

      await upsertMetaRecord({
        shopId,
        resourceId,
        resourceType,
        generatedTitle: generated.title_tag,
        generatedDescription: generated.meta_description,
        tone,
        status: "generated",
        errorMessage: null,
      });

      return {
        success: true,
        intent,
        generated: { title: generated.title_tag, description: generated.meta_description },
      };
    } catch (err) {
      await updateMetaStatus(shopId, resourceId, "failed", String(err));
      return { success: false, intent, error: String(err) };
    }
  }

  // ── Save edited meta ──────────────────────────────────────────────────────
  if (intent === "save_meta") {
    const resourceId = formData.get("resourceId") as string;
    const resourceType = formData.get("resourceType") as "product" | "article";
    const generatedTitle = formData.get("generatedTitle") as string;
    const generatedDescription = formData.get("generatedDescription") as string;
    await upsertMetaRecord({ shopId, resourceId, resourceType, generatedTitle, generatedDescription });
    return { success: true, intent };
  }

  // ── Approve / Reject ──────────────────────────────────────────────────────
  if (intent === "approve" || intent === "reject") {
    const resourceId = formData.get("resourceId") as string;
    const status: MetaStatus = intent === "approve" ? "approved" : "rejected";
    await updateMetaStatus(shopId, resourceId, status);
    return { success: true, intent };
  }

  // ── Publish ───────────────────────────────────────────────────────────────
  if (intent === "publish") {
    const resourceId = formData.get("resourceId") as string;
    const resourceType = formData.get("resourceType") as "product" | "article";
    const generatedTitle = formData.get("generatedTitle") as string;
    const generatedDescription = formData.get("generatedDescription") as string;

    if (!generatedTitle || !generatedDescription) {
      return { success: false, intent, error: "Generated title and description are required" };
    }

    const result =
      resourceType === "product"
        ? await publishProductSeo(admin, resourceId, generatedTitle, generatedDescription)
        : await publishArticleSeo(admin, resourceId, generatedTitle, generatedDescription);

    if (result.success) {
      await updateMetaStatus(shopId, resourceId, "published");
    }
    return result.success
      ? { success: true, intent }
      : { success: false, intent, error: result.error };
  }

  // ── Bulk approve / reject ─────────────────────────────────────────────────
  if (intent === "bulk_approve" || intent === "bulk_reject") {
    const ids = formData.getAll("resourceId") as string[];
    const status: MetaStatus = intent === "bulk_approve" ? "approved" : "rejected";
    await bulkUpdateMetaStatus(shopId, ids, status);
    return { success: true, intent };
  }

  // ── Bulk generate (queue) ─────────────────────────────────────────────────
  if (intent === "bulk_generate") {
    const ids = formData.getAll("resourceId") as string[];
    const resourceType = formData.get("resourceType") as "product" | "article";
    const tone = (formData.get("tone") as Tone) ?? "professional";
    const jobId = `${shopId}-gen-${Date.now()}`;

    const dbJobId = await createJob({
      shopId,
      jobId,
      jobType: "meta-generation",
      totalRecords: ids.length,
    });

    const queued = await enqueueMetaJob(
      {
        shopId,
        accessToken: session.accessToken ?? "",
        shopDomain: session.shop,
        jobDbId: dbJobId,
        jobType: "meta-generation",
        resourceIds: ids,
        resourceType,
        tone,
      },
      jobId,
    );

    if (!queued) {
      // Fallback: process inline for small batches when Redis unavailable
      if (ids.length <= 10) {
        let processed = 0;
        for (const resourceId of ids) {
          try {
            const keyword = await (await import("../services/meta-generator/db.server")).getKeyword(shopId, resourceId);
            // We don't have content here; use title only
            const title = formData.get(`title_${resourceId}`) as string ?? resourceId;
            const generated = await generateMeta({ title, contentHtml: "", keyword, tone, resourceType });
            await upsertMetaRecord({ shopId, resourceId, resourceType, generatedTitle: generated.title_tag, generatedDescription: generated.meta_description, tone, status: "generated" });
            processed++;
          } catch (err) {
            await updateMetaStatus(shopId, resourceId, "failed", String(err));
          }
        }
        return { success: true, intent, generated: undefined };
      }
      return { success: false, intent, error: "Redis not configured. Please add REDIS_URL to enable bulk queue processing." };
    }
    return { success: true, intent };
  }

  // ── Bulk publish ──────────────────────────────────────────────────────────
  if (intent === "bulk_publish") {
    const ids = formData.getAll("resourceId") as string[];
    const resourceType = formData.get("resourceType") as "product" | "article";
    const tone = (formData.get("tone") as Tone) ?? "professional";
    const jobId = `${shopId}-pub-${Date.now()}`;

    const dbJobId = await createJob({
      shopId,
      jobId,
      jobType: "meta-publish",
      totalRecords: ids.length,
    });

    await enqueueMetaJob(
      {
        shopId,
        accessToken: session.accessToken ?? "",
        shopDomain: session.shop,
        jobDbId: dbJobId,
        jobType: "meta-publish",
        resourceIds: ids,
        resourceType,
        tone,
      },
      jobId,
    );
    return { success: true, intent };
  }

  return { success: false, intent: "unknown", error: "Unknown action" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetaEditor() {
  const { records, pageInfo, filter, resourceFilter, search, tone } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<ActionResult>();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    const { success, intent, error } = fetcher.data;
    if (success) {
      const messages: Record<string, string> = {
        generate: "SEO metadata generated",
        regenerate: "SEO metadata regenerated",
        save_meta: "Changes saved",
        save_keyword: "Keyword saved",
        approve: "Record approved",
        reject: "Record rejected",
        publish: "Published to Shopify",
        bulk_approve: "Records approved",
        bulk_reject: "Records rejected",
        bulk_generate: "Bulk generation queued",
        bulk_publish: "Bulk publish queued",
      };
      shopify.toast.show(messages[intent] ?? "Done");
    } else {
      shopify.toast.show(error ?? "Something went wrong", { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set(key, value);
    next.delete("after");
    next.delete("before");
    setSearchParams(next);
  };

  return (
    <>
      {/* ── Filters ── */}
      <s-section>
        <s-stack direction="block" gap="small-200">
          <s-stack direction="inline" gap="small-200">
            {/* Resource type toggle */}
            <s-button
              variant={resourceFilter === "products" ? "primary" : "secondary"}
              onClick={() => updateParam("resource", "products")}
            >
              Products
            </s-button>
            <s-button
              variant={resourceFilter === "articles" ? "primary" : "secondary"}
              onClick={() => updateParam("resource", "articles")}
            >
              Articles
            </s-button>

            <div style={{ width: "1px", background: "var(--p-color-border)", margin: "0 4px", alignSelf: "stretch" }} />

            {/* Status filters */}
            {(["all", "missing_title", "missing_desc", "missing_both", "generated", "approved", "published", "failed"] as FilterValue[]).map((f) => {
              const labels: Record<FilterValue, string> = {
                all: "All",
                missing_title: "Missing Title",
                missing_desc: "Missing Desc",
                missing_both: "Missing Both",
                generated: "Generated",
                approved: "Approved",
                published: "Published",
                failed: "Failed",
              };
              return (
                <s-button
                  key={f}
                  variant={filter === f ? "primary" : "secondary"}
                  onClick={() => updateParam("filter", f)}
                >
                  {labels[f]}
                </s-button>
              );
            })}
          </s-stack>

          <s-stack direction="inline" gap="small-200" alignItems="center">
            <div style={{ minWidth: "240px" }}>
              <s-text-field
                label="Search by title"
                labelAccessibilityVisibility="exclusive"
                placeholder="Search..."
                value={search}
                onInput={(e: Event) => updateParam("search", (e.target as HTMLInputElement).value)}
              />
            </div>
            <s-select
              label="Tone"
              value={tone}
              onChange={(e: Event) => updateParam("tone", (e.target as HTMLSelectElement).value)}
            >
              <s-option value="professional">Professional</s-option>
              <s-option value="friendly">Friendly</s-option>
              <s-option value="minimal">Minimal</s-option>
            </s-select>
          </s-stack>
        </s-stack>
      </s-section>

      {/* ── Table ── */}
      <s-section>
        <MetaTable
          records={records}
          tone={tone}
          resourceFilter={resourceFilter}
          fetcher={fetcher}
          pageInfo={pageInfo}
          searchParams={searchParams}
          setSearchParams={setSearchParams}
        />
      </s-section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
