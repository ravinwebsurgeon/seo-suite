import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import React, { useEffect, useState, useRef } from "react";
import { authenticate } from "../shopify.server";
import {
  publishProductSeo,
  publishArticleSeo,
} from "../services/meta-generator/shopify.server";
import {
  upsertKeyword,
  getKeyword,
  upsertMetaRecord,
  updateMetaStatus,
  bulkUpdateMetaStatus,
  createJob,
  getMetaRecordsForIds,
} from "../services/meta-generator/db.server";
import { resolveEditorPage } from "../services/meta-generator/editor-query.server";
import { generateMeta } from "../services/meta-generator/claude.server";
import { enqueueMetaJob } from "../services/meta-generator/queue.server";
import { MetaTable } from "../components/meta-generator/MetaTable";
import type {
  MetaRecord,
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
  // `filter` = SEO-state (all | missing_title | missing_desc | missing_both).
  // `status` = workflow status (all | pending | generated | approved | ...).
  // The two are INDEPENDENT and combine (AND) so e.g. "Generated + Missing
  // Title" is expressible — see Step 2/3 of the spec.
  const filter = url.searchParams.get("filter") ?? "all";
  const status = url.searchParams.get("status") ?? "all";
  const search = url.searchParams.get("search") ?? "";
  const tone = (url.searchParams.get("tone") ?? "professional") as Tone;
  const after = url.searchParams.get("after") ?? null;
  const before = url.searchParams.get("before") ?? null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1") || 1);

  const resourceType = resourceFilter === "articles" ? "article" : "product";

  let resolved = {
    records: [] as MetaRecord[],
    pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null as string | null, endCursor: null as string | null },
    pageMode: "cursor" as "cursor" | "offset",
    currentPage: 1,
  };

  try {
    resolved = await resolveEditorPage(admin, shopId, {
      resourceType,
      filter,
      status,
      search,
      tone,
      after,
      before,
      page,
    });
  } catch (err) {
    console.error("[editor loader] filter=%s status=%s resource=%s error:", filter, status, resourceFilter, err);
  }

  return {
    records: resolved.records,
    pageInfo: resolved.pageInfo,
    filter,
    status,
    resourceFilter,
    search,
    tone,
    pageMode: resolved.pageMode,
    currentPage: resolved.currentPage,
  };
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
        for (const resourceId of ids) {
          try {
            const keyword = await getKeyword(shopId, resourceId);
            // We don't have content here; use title only
            const title = formData.get(`title_${resourceId}`) as string ?? resourceId;
            const generated = await generateMeta({ title, contentHtml: "", keyword, tone, resourceType });
            await upsertMetaRecord({ shopId, resourceId, resourceType, generatedTitle: generated.title_tag, generatedDescription: generated.meta_description, tone, status: "generated" });
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

    const queued = await enqueueMetaJob(
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

    if (!queued) {
      // No Redis worker available: publish inline using the already-approved
      // values so a small batch still reaches Shopify instead of silently
      // reporting success while nothing is written.
      if (ids.length <= 10) {
        let published = 0;
        const records = await getMetaRecordsForIds(shopId, ids);
        const byId = new Map(records.map((r) => [r.resourceId, r]));
        for (const resourceId of ids) {
          const record = byId.get(resourceId);
          const seoTitle = record?.generatedTitle ?? "";
          const seoDescription = record?.generatedDescription ?? "";
          if (!seoTitle || !seoDescription) {
            await updateMetaStatus(shopId, resourceId, "failed", "Nothing to publish");
            continue;
          }
          const result =
            resourceType === "product"
              ? await publishProductSeo(admin, resourceId, seoTitle, seoDescription)
              : await publishArticleSeo(admin, resourceId, seoTitle, seoDescription);
          if (result.success) {
            await updateMetaStatus(shopId, resourceId, "published");
            published++;
          } else {
            await updateMetaStatus(shopId, resourceId, "failed", result.error);
          }
        }
        return published > 0
          ? { success: true, intent }
          : { success: false, intent, error: "Publish failed for all selected records" };
      }
      return { success: false, intent, error: "Redis not configured. Please add REDIS_URL to enable bulk publish processing." };
    }
    return { success: true, intent };
  }

  return { success: false, intent: "unknown", error: "Unknown action" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetaEditor() {
  const { records, pageInfo, filter, status, resourceFilter, search, tone, pageMode, currentPage } =
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

          {/* SEO-state filter: All / Missing Title / Missing Description / All Missing */}
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
              <option value="all">All</option>
              <option value="missing_title">Missing Title</option>
              <option value="missing_desc">Missing Description</option>
              <option value="missing_both">Missing Both</option>
            </select>
            <svg style={{ position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--p-color-icon)" }} width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 4.5l4 3.5 4-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          {/* Divider */}
          <div style={{ width: "1px", height: "22px", background: "var(--p-color-border)", flexShrink: 0, margin: "0 2px" }} />

          {/* Status filter */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <select
              value={status}
              onChange={(e) => updateParam("status", e.target.value)}
              style={{
                padding: "5px 28px 5px 10px",
                border: `1px solid ${status !== "all" ? "var(--p-color-border-emphasis)" : "var(--p-color-border)"}`,
                borderRadius: "8px",
                background: status !== "all" ? "var(--p-color-bg-fill-info-secondary)" : "var(--p-color-bg-surface)",
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
