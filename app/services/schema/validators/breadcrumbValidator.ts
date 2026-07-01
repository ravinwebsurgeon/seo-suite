// ─── Breadcrumb schema validator ──────────────────────────────────────────────

import type { SchemaValidationResult } from "../../../types/schema-validation";
import { asRecord, createCollector, isNonEmptyString, isValidUrl } from "./shared";

export function validateBreadcrumbSchema(schema: Record<string, unknown>): SchemaValidationResult {
  const c = createCollector();

  const items = schema.itemListElement;
  if (!Array.isArray(items) || items.length === 0) {
    c.error("itemListElement", "Breadcrumb Items", "No breadcrumb items found.", "Add at least one breadcrumb item.");
    return c.finalize("BreadcrumbList");
  }

  c.pass("itemListElement", "Breadcrumb Items", `${items.length} breadcrumb item(s) present.`);

  const positions: number[] = [];
  items.forEach((raw, i) => {
    const item = asRecord(raw);
    const label = `Item ${i + 1}`;
    if (!item) {
      c.error(`itemListElement.${i}`, label, "Entry is not a valid ListItem object.");
      return;
    }
    if (!isNonEmptyString(item.name)) {
      c.error(`itemListElement.${i}.name`, label, "Breadcrumb label is empty.", "Add a name for this item.");
    }
    // `item` (the URL) is optional for the last crumb but recommended for others.
    if (item.item === undefined || item.item === null || item.item === "") {
      if (i < items.length - 1) {
        c.warn(`itemListElement.${i}.item`, label, "Breadcrumb URL is missing.", "Add the page URL for this crumb.");
      }
    } else if (!isValidUrl(item.item)) {
      c.error(`itemListElement.${i}.item`, label, "Breadcrumb URL is invalid.", "Use an absolute http(s) URL.");
    }
    if (typeof item.position === "number") positions.push(item.position);
  });

  // Positions should be sequential 1..n.
  const sequential = positions.length === items.length &&
    positions.every((p, idx) => p === idx + 1);
  if (positions.length === items.length && !sequential) {
    c.warn("position", "Positions", "Breadcrumb positions are not sequential.", "Number items 1, 2, 3 … in order.");
  } else if (sequential) {
    c.pass("position", "Positions", "Breadcrumb positions are sequential.");
  }

  return c.finalize("BreadcrumbList");
}
