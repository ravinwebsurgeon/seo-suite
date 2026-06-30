// Shared query resolution for the Bulk Meta editor. Both the editor loader
// (paginated view) and the CSV export route run through this module so the two
// can never disagree about what a given filter / status / search combination
// means. See Steps 2, 3, 9 and 10 of the spec.

import {
  fetchProducts,
  fetchArticles,
  fetchProductsByIds,
  fetchArticlesByIds,
  scanAllSeoNodes,
  matchesMissingSeo,
} from "./shopify.server";
import type { SeoLiteNode, MissingSeoKind } from "./shopify.server";
import {
  getKeywordsForIds,
  getMetaRecordsForIds,
  getResourceIdsByStatus,
  getResourceIdsByStatuses,
} from "./db.server";
import type {
  MetaRecord,
  MetaStatus,
  PageInfo,
  ResourceType,
  Tone,
} from "../../types/meta-generator";

type AdminGraphQL = { graphql: (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response> };

export const PAGE_SIZE = 25;

// Having a row in any of these means a resource is NOT pending.
const ACTED_STATUSES: MetaStatus[] = ["generated", "approved", "rejected", "published", "failed"];
const DB_STATUSES: MetaStatus[] = ["generated", "approved", "rejected", "published", "failed"];

export const isDbStatus = (s: string): s is MetaStatus =>
  (DB_STATUSES as readonly string[]).includes(s);

const MISSING_SEO_KIND: Record<string, MissingSeoKind> = {
  missing_title: "title",
  missing_desc: "desc",
  missing_both: "both",
};
export const isMissingSeoFilter = (f: string): boolean =>
  Object.prototype.hasOwnProperty.call(MISSING_SEO_KIND, f);

export interface EditorQuery {
  resourceType: ResourceType;
  filter: string; // all | missing_title | missing_desc | missing_both
  status: string; // all | pending | generated | approved | rejected | published | failed
  search: string;
  tone: Tone;
  after?: string | null;
  before?: string | null;
  page?: number;
}

export interface ResolvedPage {
  records: MetaRecord[];
  pageInfo: PageInfo;
  pageMode: "cursor" | "offset";
  currentPage: number;
}

const toLite = (i: { id: string; title: string; handle: string; seo: { title: string | null; description: string | null }; updatedAt: string }): SeoLiteNode =>
  ({ id: i.id, title: i.title, handle: i.handle, seo: i.seo, updatedAt: i.updatedAt });

// Join scanned Shopify lite nodes with our DB rows into full MetaRecords. No
// extra Shopify round-trip — the lite node already carries title/handle/seo.
async function hydrate(
  shopId: string,
  resourceType: ResourceType,
  tone: Tone,
  nodes: SeoLiteNode[],
  statusFallback: MetaStatus,
): Promise<MetaRecord[]> {
  if (nodes.length === 0) return [];
  const ids = nodes.map((n) => n.id);
  const [keywordMap, metaRows] = await Promise.all([
    getKeywordsForIds(shopId, ids),
    getMetaRecordsForIds(shopId, ids),
  ]);
  const metaMap = new Map(metaRows.map((r) => [r.resourceId, r]));
  return nodes.map((node) => {
    const meta = metaMap.get(node.id);
    return {
      resourceId: node.id,
      resourceType,
      title: node.title,
      handle: node.handle,
      currentSeoTitle: node.seo?.title ?? null,
      currentSeoDescription: node.seo?.description ?? null,
      keyword: keywordMap.get(node.id) ?? null,
      generatedTitle: meta?.generatedTitle ?? null,
      generatedDescription: meta?.generatedDescription ?? null,
      tone: (meta?.tone ?? tone) as Tone,
      status: (meta?.status ?? statusFallback) as MetaStatus,
      dbId: meta?.id ?? null,
      updatedAt: node.updatedAt,
    };
  });
}

// Resolve the full candidate node list for an ID-driven query (any SEO filter
// and/or status). Applies SEO filter, status filter and search — but NOT
// pagination. Shared by the paged view and the full export.
async function resolveNodes(admin: AdminGraphQL, shopId: string, q: EditorQuery): Promise<SeoLiteNode[]> {
  const { resourceType, filter, status, search } = q;
  const isArticles = resourceType === "article";
  const seoFilterActive = isMissingSeoFilter(filter);
  // A SEO-state filter, or a "pending" status, needs a full catalog scan
  // (Shopify can't query empty SEO fields or "has no DB row"). A pure DB status
  // is answered from the DB ID list + a targeted by-id fetch.
  const needFullScan = seoFilterActive || status === "pending";

  let nodes: SeoLiteNode[];
  if (needFullScan) {
    nodes = await scanAllSeoNodes(admin, resourceType);
  } else {
    const ids = await getResourceIdsByStatus(shopId, status as MetaStatus, resourceType);
    const items = isArticles ? await fetchArticlesByIds(admin, ids) : await fetchProductsByIds(admin, ids);
    nodes = items.map(toLite);
  }

  if (seoFilterActive) {
    const kind = MISSING_SEO_KIND[filter];
    nodes = nodes.filter((n) => matchesMissingSeo(n, kind));
  }

  if (status !== "all" && needFullScan) {
    if (status === "pending") {
      const acted = new Set(await getResourceIdsByStatuses(shopId, ACTED_STATUSES, resourceType));
      nodes = nodes.filter((n) => !acted.has(n.id));
    } else if (isDbStatus(status)) {
      const allowed = new Set(await getResourceIdsByStatus(shopId, status as MetaStatus, resourceType));
      nodes = nodes.filter((n) => allowed.has(n.id));
    }
  }

  if (search) {
    const query = search.toLowerCase();
    nodes = nodes.filter(
      (n) => n.title.toLowerCase().includes(query) || n.handle.toLowerCase().includes(query),
    );
  }

  return nodes;
}

// Resolve one paginated page for the editor view.
export async function resolveEditorPage(admin: AdminGraphQL, shopId: string, q: EditorQuery): Promise<ResolvedPage> {
  const { resourceType, filter, status, search, tone, after, before } = q;
  const page = Math.max(1, q.page ?? 1);
  const isArticles = resourceType === "article";
  const seoFilterActive = isMissingSeoFilter(filter);
  const statusActive = status !== "all";

  // Fast path: no SEO/status constraint → cursor pagination with server-side
  // title search. Avoids scanning the entire catalog.
  if (!seoFilterActive && !statusActive) {
    let pageInfo: PageInfo = { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null };
    const shopifyQuery = search ? `title:${search}*` : undefined;
    const commonArgs = {
      first: before ? undefined : PAGE_SIZE,
      last: before ? PAGE_SIZE : undefined,
      after: after ?? undefined,
      before: before ?? undefined,
      query: shopifyQuery ?? undefined,
    };
    const items = !isArticles
      ? (await fetchProducts(admin, commonArgs).then((r) => ((pageInfo = r.pageInfo), r.products)))
      : (await fetchArticles(admin, commonArgs).then((r) => ((pageInfo = r.pageInfo), r.articles)));
    const records = await hydrate(shopId, resourceType, tone, items.map(toLite), "pending");
    return { records, pageInfo, pageMode: "cursor", currentPage: 1 };
  }

  const offset = (page - 1) * PAGE_SIZE;
  const fallback: MetaStatus = isDbStatus(status) ? (status as MetaStatus) : "pending";

  // Pure DB-status (no SEO filter, no search): we can page the DB ID list
  // directly and only fetch the 25 resources on this page from Shopify —
  // no whole-catalog scan and no fetching the entire status set.
  if (!seoFilterActive && status !== "pending" && !search && isDbStatus(status)) {
    const ids = await getResourceIdsByStatus(shopId, status as MetaStatus, resourceType);
    const pageIds = ids.slice(offset, offset + PAGE_SIZE);
    const items = isArticles ? await fetchArticlesByIds(admin, pageIds) : await fetchProductsByIds(admin, pageIds);
    const pageInfo: PageInfo = {
      hasNextPage: offset + PAGE_SIZE < ids.length,
      hasPreviousPage: page > 1,
      startCursor: null,
      endCursor: null,
    };
    const records = await hydrate(shopId, resourceType, tone, items.map(toLite), fallback);
    return { records, pageInfo, pageMode: "offset", currentPage: page };
  }

  // General constrained path: resolve the full filtered set, then offset-page.
  const nodes = await resolveNodes(admin, shopId, q);
  const pageInfo: PageInfo = {
    hasNextPage: offset + PAGE_SIZE < nodes.length,
    hasPreviousPage: page > 1,
    startCursor: null,
    endCursor: null,
  };
  const records = await hydrate(shopId, resourceType, tone, nodes.slice(offset, offset + PAGE_SIZE), fallback);
  return { records, pageInfo, pageMode: "offset", currentPage: page };
}

// Resolve EVERY matching record (no pagination) for CSV export. Honours the
// same filter / status / search, including the "all + all" case via a full scan.
export async function resolveAllEditorRecords(admin: AdminGraphQL, shopId: string, q: EditorQuery): Promise<MetaRecord[]> {
  const seoFilterActive = isMissingSeoFilter(q.filter);
  const statusActive = q.status !== "all";

  let nodes: SeoLiteNode[];
  if (!seoFilterActive && !statusActive) {
    // Export-all with no constraint: scan the whole catalog, then search-filter.
    nodes = await scanAllSeoNodes(admin, q.resourceType);
    if (q.search) {
      const query = q.search.toLowerCase();
      nodes = nodes.filter(
        (n) => n.title.toLowerCase().includes(query) || n.handle.toLowerCase().includes(query),
      );
    }
  } else {
    nodes = await resolveNodes(admin, shopId, q);
  }

  const fallback: MetaStatus = isDbStatus(q.status) ? (q.status as MetaStatus) : "pending";
  return hydrate(shopId, q.resourceType, q.tone, nodes, fallback);
}
