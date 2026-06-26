import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import React, { useEffect, useState, useRef } from "react";
import { authenticate } from "../shopify.server";
import {
  fetchProducts,
  fetchArticles,
  fetchProductsByIds,
  fetchArticlesByIds,
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
  getResourceIdsByStatus,
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

const STATUS_FILTER_VALUES = ["generated", "approved", "rejected", "published", "failed"] as const;
type StatusFilterValue = typeof STATUS_FILTER_VALUES[number];
const isStatusFilter = (f: string): f is StatusFilterValue =>
  (STATUS_FILTER_VALUES as readonly string[]).includes(f);

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
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);
  const PAGE_SIZE = 25;

  let records: MetaRecord[] = [];
  let pageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null as string | null, endCursor: null as string | null };
  let pageMode: "cursor" | "offset" = "cursor";
  let currentPage = 1;

  const isArticles = resourceFilter === "articles";
  const resourceType = isArticles ? "article" : "product";

  try {
    if (isStatusFilter(filter)) {
      // DB-first: get all IDs with this status, then paginate and fetch from Shopify
      pageMode = "offset";
      currentPage = page;

      const allIds = await getResourceIdsByStatus(shopId, filter as MetaStatus, resourceType);
      const totalCount = allIds.length;
      const offset = (page - 1) * PAGE_SIZE;
      const pageIds = allIds.slice(offset, offset + PAGE_SIZE);

      pageInfo = {
        hasNextPage: offset + PAGE_SIZE < totalCount,
        hasPreviousPage: page > 1,
        startCursor: null,
        endCursor: null,
      };

      if (pageIds.length > 0) {
        const [shopifyItems, keywordMap, metaRows] = await Promise.all([
          isArticles
            ? fetchArticlesByIds(admin, pageIds)
            : fetchProductsByIds(admin, pageIds),
          getKeywordsForIds(shopId, pageIds),
          getMetaRecordsForIds(shopId, pageIds),
        ]);
        const metaMap = new Map(metaRows.map((r) => [r.resourceId, r]));

        records = shopifyItems.map((item) => {
          const meta = metaMap.get(item.id);
          return {
            resourceId: item.id,
            resourceType: resourceType as MetaRecord["resourceType"],
            title: item.title,
            handle: item.handle,
            currentSeoTitle: item.seo?.title ?? null,
            currentSeoDescription: item.seo?.description ?? null,
            keyword: keywordMap.get(item.id) ?? null,
            generatedTitle: meta?.generatedTitle ?? null,
            generatedDescription: meta?.generatedDescription ?? null,
            tone: (meta?.tone ?? tone) as Tone,
            status: (meta?.status ?? filter) as MetaStatus,
            dbId: meta?.id ?? null,
            updatedAt: item.updatedAt,
          };
        });

        if (search) {
          records = records.filter((r) =>
            r.title.toLowerCase().includes(search.toLowerCase()),
          );
        }
      }
    } else {
      // Shopify-first: cursor-based pagination from Shopify, then filter by SEO fields
      pageMode = "cursor";
      const shopifyQuery = search ? `title:${search}*` : undefined;

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
            currentSeoTitle: p.seo?.title ?? null,
            currentSeoDescription: p.seo?.description ?? null,
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
            currentSeoTitle: a.seo?.title ?? null,
            currentSeoDescription: a.seo?.description ?? null,
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

      if (filter === "pending") records = records.filter((r) => r.status === "pending");
      else if (filter === "missing_title") records = records.filter((r) => !r.currentSeoTitle);
      else if (filter === "missing_desc") records = records.filter((r) => !r.currentSeoDescription);
      else if (filter === "missing_both") records = records.filter((r) => !r.currentSeoTitle && !r.currentSeoDescription);
    }
  } catch (err) {
    console.error("[editor loader] filter=%s resource=%s error:", filter, resourceFilter, err);
  }

  return { records, pageInfo, filter, resourceFilter, search, tone, pageMode, currentPage };
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
        jobId,
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
        jobId,
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
  const { records, pageInfo, filter, resourceFilter, search, tone, pageMode, currentPage } =
    useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher<ActionResult>();
  const shopify = useAppBridge();

  const [searchValue, setSearchValue] = useState(search);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local search input when loader data changes (back/forward navigation)
  useEffect(() => {
    setSearchValue(search);
  }, [search]);

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
    next.delete("page");
    setSearchParams(next);
  };

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => updateParam("search", value), 400);
  };

  return (
    <>
      {/* ── Filters ── */}
      <s-section>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          background: "var(--p-color-bg-surface)",
          border: "1px solid var(--p-color-border)",
          borderRadius: "12px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
          flexWrap: "wrap",
          rowGap: "8px",
        }}>

          {/* Segmented toggle: Products / Articles */}
          <div style={{
            display: "inline-flex",
            background: "var(--p-color-bg-surface-secondary)",
            borderRadius: "8px",
            padding: "2px",
            flexShrink: 0,
          }}>
            {(["products", "articles"] as const).map((r) => (
              <button
                key={r}
                onClick={() => updateParam("resource", r)}
                style={{
                  padding: "5px 14px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: resourceFilter === r ? "600" : "500",
                  lineHeight: "20px",
                  background: resourceFilter === r ? "var(--p-color-bg-surface)" : "transparent",
                  color: resourceFilter === r ? "var(--p-color-text)" : "var(--p-color-text-subdued)",
                  boxShadow: resourceFilter === r ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.12s ease",
                }}
              >
                {r === "products" ? "Products" : "Articles"}
              </button>
            ))}
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "22px", background: "var(--p-color-border)", flexShrink: 0, margin: "0 2px" }} />

          {/* Status filter */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={filter}
              onChange={(e) => updateParam("filter", e.target.value)}
              style={{
                padding: "5px 28px 5px 10px",
                border: `1px solid ${filter !== "all" ? "var(--p-color-border-emphasis)" : "var(--p-color-border)"}`,
                borderRadius: "8px",
                background: filter !== "all" ? "var(--p-color-bg-fill-info-secondary)" : "var(--p-color-bg-surface)",
                color: "var(--p-color-text)",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                outline: "none",
                lineHeight: "20px",
                minWidth: "135px",
                WebkitAppearance: "none",
                appearance: "none",
              } as React.CSSProperties}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="generated">Generated</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="published">Published</option>
              <option value="failed">Failed</option>
              <option value="missing_title">Missing Title</option>
              <option value="missing_desc">Missing Desc</option>
              <option value="missing_both">Missing Both</option>
            </select>
            <svg style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--p-color-icon)" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4.5l4 3.5 4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Tone filter */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={tone}
              onChange={(e) => updateParam("tone", e.target.value)}
              style={{
                padding: "5px 28px 5px 10px",
                border: "1px solid var(--p-color-border)",
                borderRadius: "8px",
                background: "var(--p-color-bg-surface)",
                color: "var(--p-color-text)",
                fontSize: "13px",
                fontWeight: "500",
                cursor: "pointer",
                outline: "none",
                lineHeight: "20px",
                minWidth: "128px",
                WebkitAppearance: "none",
                appearance: "none",
              } as React.CSSProperties}
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="minimal">Minimal</option>
            </select>
            <svg style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--p-color-icon)" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4.5l4 3.5 4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "22px", background: "var(--p-color-border)", flexShrink: 0, margin: "0 2px" }} />

          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 180px", minWidth: "160px" }}>
            <svg style={{ position: "absolute", left: "9px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--p-color-icon-subdued)" }} width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="search"
              placeholder="Search by title…"
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                display: "block",
                width: "100%",
                padding: "5px 10px 5px 30px",
                border: "1px solid var(--p-color-border)",
                borderRadius: "8px",
                background: "var(--p-color-bg-surface)",
                color: "var(--p-color-text)",
                fontSize: "13px",
                outline: "none",
                lineHeight: "20px",
                boxSizing: "border-box",
              } as React.CSSProperties}
            />
          </div>

        </div>
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
          pageMode={pageMode}
          currentPage={currentPage}
        />
      </s-section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
