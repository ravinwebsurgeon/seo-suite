import type { LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { resolveAllEditorRecords } from "../services/meta-generator/editor-query.server";
import type { ResourceType, Tone } from "../types/meta-generator";

// CSV export endpoint. Honours the SAME query params as the editor view
// (resource / filter / status / search / tone) so the export always reflects
// the active filters — see Step 9 of the spec. Returns the FULL filtered set,
// not just the current page.
const CSV_COLUMNS = [
  "Handle",
  "Product Title",
  "Current SEO Title",
  "Generated SEO Title",
  "Current Meta Description",
  "Generated Meta Description",
  "Keyword",
  "Status",
];

// RFC-4180 escaping: wrap in quotes and double any embedded quotes.
const esc = (value: string | null | undefined): string => `"${String(value ?? "").replace(/"/g, '""')}"`;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const url = new URL(request.url);

  const resourceType = (url.searchParams.get("resource") === "articles" ? "article" : "product") as ResourceType;
  const filter = url.searchParams.get("filter") ?? "all";
  const status = url.searchParams.get("status") ?? "all";
  const search = url.searchParams.get("search") ?? "";
  const tone = (url.searchParams.get("tone") ?? "professional") as Tone;

  const records = await resolveAllEditorRecords(admin, shopId, {
    resourceType,
    filter,
    status,
    search,
    tone,
  });

  const lines = [
    CSV_COLUMNS.join(","),
    ...records.map((r) =>
      [
        esc(r.handle),
        esc(r.title),
        esc(r.currentSeoTitle),
        esc(r.generatedTitle),
        esc(r.currentSeoDescription),
        esc(r.generatedDescription),
        esc(r.keyword),
        esc(r.status),
      ].join(","),
    ),
  ];
  // Prepend a BOM so Excel reads UTF-8 correctly.
  const csv = "﻿" + lines.join("\r\n");

  const stamp = new URL(request.url).searchParams.get("ts") ?? "";
  const filename = `seo-meta-${resourceType}s${stamp ? "-" + stamp : ""}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
