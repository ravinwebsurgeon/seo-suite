// ─── Article schema validator ─────────────────────────────────────────────────

import type { SchemaValidationResult } from "../../../types/schema-validation";
import {
  asRecord,
  createCollector,
  isNonEmptyString,
  isValidUrl,
  MIN_DESCRIPTION_LENGTH,
} from "./shared";

/** Returns true for a valid ISO-8601 / parseable date string. */
function isValidDate(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  const ts = Date.parse(value);
  return !Number.isNaN(ts);
}

export function validateArticleSchema(schema: Record<string, unknown>): SchemaValidationResult {
  const c = createCollector();

  // Required: headline
  if (!isNonEmptyString(schema.headline)) {
    c.error("headline", "Headline", "Headline is missing.", "Add the article title.");
  } else {
    c.pass("headline", "Headline", "Headline is present.");
  }

  // Required: datePublished (valid date)
  if (!isNonEmptyString(schema.datePublished)) {
    c.error("datePublished", "Published Date", "Published date is missing.", "Set the publish date.");
  } else if (!isValidDate(schema.datePublished)) {
    c.error("datePublished", "Published Date", "Published date is not a valid date.", "Use ISO-8601, e.g. 2026-01-31.");
  } else {
    c.pass("datePublished", "Published Date", "Published date is present and valid.");
  }

  // Recommended: image
  const image = schema.image;
  if (isNonEmptyString(image)) {
    if (isValidUrl(image)) c.pass("image", "Image", "Image URL is present and valid.");
    else c.error("image", "Image", "Image URL is invalid.", "Use an absolute http(s) URL.");
  } else {
    c.warn("image", "Image", "Article image is missing.", "Add a featured image for rich results.");
  }

  // Recommended: author
  const author = asRecord(schema.author);
  if (author ? isNonEmptyString(author.name) : isNonEmptyString(schema.author)) {
    c.pass("author", "Author", "Author is present.");
  } else {
    c.warn("author", "Author", "Author is missing.", "Add the article author.");
  }

  // Recommended: url
  if (!isNonEmptyString(schema.url)) {
    c.warn("url", "URL", "Article URL is missing.", "Add the canonical article URL.");
  } else if (!isValidUrl(schema.url)) {
    c.error("url", "URL", "Article URL is invalid.", "Use an absolute http(s) URL.");
  } else {
    c.pass("url", "URL", "Article URL is present and valid.");
  }

  // Suggestion: description
  if (!isNonEmptyString(schema.description)) {
    c.suggest("description", "Description", "Description not set.", "Add a short article summary.");
  } else {
    c.pass("description", "Description", "Description is present.");
    if ((schema.description as string).trim().length < MIN_DESCRIPTION_LENGTH) {
      c.suggest("description", "Description", `Description is short (< ${MIN_DESCRIPTION_LENGTH} characters).`, "Expand the summary.");
    }
  }

  // Suggestion: dateModified
  if (!isNonEmptyString(schema.dateModified)) {
    c.suggest("dateModified", "Modified Date", "Modified date not set.", "Add dateModified for freshness signals.");
  } else {
    c.pass("dateModified", "Modified Date", "Modified date is present.");
  }

  return c.finalize("Article");
}
