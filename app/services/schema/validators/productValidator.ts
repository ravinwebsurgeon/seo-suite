// ─── Product schema validator ─────────────────────────────────────────────────
//
// Validates a generated Product JSON-LD object against schema.org / Google
// Rich Results expectations. Operates purely on the JSON-LD, with an optional
// context object for the advanced cross-field consistency checks that cannot be
// inferred from the markup alone (inventory, compare-at price).

import type {
  ProductValidationContext,
  SchemaValidationResult,
} from "../../../types/schema-validation";
import {
  asRecord,
  createCollector,
  isNonEmptyString,
  isValidAvailability,
  isValidCurrency,
  isValidUrl,
  MIN_DESCRIPTION_LENGTH,
  normalizeAvailability,
  parsePrice,
} from "./shared";

export function validateProductSchema(
  schema: Record<string, unknown>,
  context: ProductValidationContext = {},
): SchemaValidationResult {
  const c = createCollector();

  // ── Required: name ──────────────────────────────────────────────────────────
  if (!isNonEmptyString(schema.name)) {
    c.error("name", "Product Name", "Product name is missing.", "Add a descriptive product title.");
  } else {
    c.pass("name", "Product Name", "Product name is present.");
  }

  // ── Required: image (string or non-empty array) ──────────────────────────────
  const image = schema.image;
  if (Array.isArray(image)) {
    if (image.length === 0) {
      c.error("image", "Image", "Image array is empty.", "Add at least one product image URL.");
    } else if (!image.every((i) => isValidUrl(i))) {
      c.error("image", "Image", "One or more image URLs are invalid.", "Use absolute http(s) URLs.");
    } else {
      c.pass("image", "Image", `${image.length} valid image URL(s) present.`);
    }
  } else if (isNonEmptyString(image)) {
    if (isValidUrl(image)) {
      c.pass("image", "Image", "Image URL is present and valid.");
    } else {
      c.error("image", "Image", "Image URL is invalid.", "Use an absolute http(s) URL.");
    }
  } else {
    c.error("image", "Image", "Product image is missing.", "Use the product's featured image URL.");
  }

  // ── Required: description ─────────────────────────────────────────────────────
  if (!isNonEmptyString(schema.description)) {
    c.error(
      "description",
      "Description",
      "Product description is missing.",
      "Add a description (aim for 50+ characters).",
    );
  } else {
    c.pass("description", "Description", "Product description is present.");
    if ((schema.description as string).trim().length < MIN_DESCRIPTION_LENGTH) {
      c.suggest(
        "description",
        "Description",
        `Description is short (< ${MIN_DESCRIPTION_LENGTH} characters).`,
        "Expand the description for richer results.",
      );
    }
  }

  // ── Required: offers object + its sub-fields ─────────────────────────────────
  const offers = asRecord(schema.offers);
  if (!offers) {
    c.error(
      "offers",
      "Offers",
      "Offers object is missing.",
      "Add an Offer with price, currency and availability.",
    );
  } else {
    c.pass("offers", "Offers", "Offers object is present.");

    // offers.price — required, must be > 0
    const price = parsePrice(offers.price);
    if (offers.price === undefined || offers.price === null || offers.price === "") {
      c.error("offers.price", "Price", "Price is missing.", "Set a numeric price greater than 0.");
    } else if (Number.isNaN(price)) {
      c.error("offers.price", "Price", "Price is not a valid number.", "Use a numeric value, e.g. 29.99.");
    } else if (price <= 0) {
      c.error("offers.price", "Price", "Price must be greater than 0.", "Set a positive price.");
    } else {
      c.pass("offers.price", "Price", "Price is present and valid.");
    }

    // offers.priceCurrency — required, must be valid ISO 4217
    if (!isNonEmptyString(offers.priceCurrency)) {
      c.error("offers.priceCurrency", "Currency", "Currency is missing.", "Add an ISO 4217 code, e.g. USD.");
    } else if (!isValidCurrency(offers.priceCurrency)) {
      c.error(
        "offers.priceCurrency",
        "Currency",
        `"${offers.priceCurrency}" is not a valid ISO 4217 currency code.`,
        "Use a valid code such as USD, EUR or GBP.",
      );
    } else {
      c.pass("offers.priceCurrency", "Currency", "Currency is a valid ISO 4217 code.");
    }

    // offers.availability — required, must be a schema.org value
    if (offers.availability === undefined || offers.availability === null || offers.availability === "") {
      c.error(
        "offers.availability",
        "Availability",
        "Availability is missing.",
        "Set a schema.org availability, e.g. InStock.",
      );
    } else if (!isValidAvailability(offers.availability)) {
      c.error(
        "offers.availability",
        "Availability",
        "Availability is not a valid schema.org value.",
        "Use InStock, OutOfStock, PreOrder, etc.",
      );
    } else {
      c.pass("offers.availability", "Availability", "Availability is a valid schema.org value.");
    }

    // offers.url — recommended + validated when present
    if (!isNonEmptyString(offers.url)) {
      c.warn("offers.url", "Product URL", "Offer URL is missing.", "Add the canonical product page URL.");
    } else if (!isValidUrl(offers.url)) {
      c.error("offers.url", "Product URL", "Offer URL is invalid.", "Use an absolute http(s) URL.");
    } else {
      c.pass("offers.url", "Product URL", "Product URL is present and valid.");
    }
  }

  // ── Recommended fields (warnings) ─────────────────────────────────────────────
  checkRecommended(c, schema, "sku", "SKU", "Add the variant SKU for better matching.");
  const brand = asRecord(schema.brand);
  if (brand ? isNonEmptyString(brand.name) : isNonEmptyString(schema.brand)) {
    c.pass("brand", "Brand", "Brand is present.");
  } else {
    c.warn("brand", "Brand", "Brand is missing.", "Use the Shopify vendor as the brand.");
  }
  checkRecommended(c, schema, "gtin", "GTIN", "Add a GTIN/UPC/EAN if available.");

  // ── SEO suggestions ───────────────────────────────────────────────────────────
  suggestField(c, schema, "aggregateRating", "Aggregate Rating", "Add aggregate rating to earn star snippets.");
  suggestField(c, schema, "review", "Reviews", "Add customer reviews to enrich the listing.");c
  suggestField(c, schema, "color", "Color", "Add the product color.");
  suggestField(c, schema, "size", "Size", "Add the product size.");
  suggestField(c, schema, "material", "Material", "Add the product material.");
  if (brand && !isNonEmptyString(brand.logo)) {
    c.suggest("brand.logo", "Brand Logo", "Brand logo is missing.", "Add a brand logo URL.");
  }

  // ── Advanced / cross-field consistency checks ────────────────────────────────
  runAdvancedChecks(c, schema, offers, context);

  return c.finalize("Product");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function checkRecommended(
  c: ReturnType<typeof createCollector>,
  schema: Record<string, unknown>,
  key: string,
  label: string,
  recommendation: string,
) {
  if (isNonEmptyString(schema[key])) {
    c.pass(key, label, `${label} is present.`);
  } else {
    c.warn(key, label, `${label} is missing.`, recommendation);
  }
}

function suggestField(
  c: ReturnType<typeof createCollector>,
  schema: Record<string, unknown>,
  key: string,
  label: string,
  recommendation: string,
) {
  const value = schema[key];
  const present = Array.isArray(value)
    ? value.length > 0
    : asRecord(value)
      ? true
      : isNonEmptyString(value);
  if (present) {
    c.pass(key, label, `${label} is present.`);
  } else {
    c.suggest(key, label, `${label} not set.`, recommendation);
  }
}

function runAdvancedChecks(
  c: ReturnType<typeof createCollector>,
  schema: Record<string, unknown>,
  offers: Record<string, unknown> | null,
  context: ProductValidationContext,
) {
  // Inventory zero but availability InStock.
  if (offers && typeof context.inventory === "number") {
    const availability = normalizeAvailability(offers.availability);
    if (context.inventory <= 0 && availability === "InStock") {
      c.error(
        "offers.availability",
        "Availability",
        "Inventory is zero but availability is set to InStock.",
        "Set availability to OutOfStock.",
      );
    }
  }

  // Compare-at price lower than the selling price.
  if (offers && typeof context.compareAtPrice === "number" && context.compareAtPrice > 0) {
    const price = parsePrice(offers.price);
    if (!Number.isNaN(price) && context.compareAtPrice < price) {
      c.warn(
        "offers.price",
        "Compare-at Price",
        "Compare-at price is lower than the selling price.",
        "The compare-at price should be higher than the sale price.",
      );
    }
  }

  // Empty arrays anywhere at the top level.
  for (const [key, value] of Object.entries(schema)) {
    if (Array.isArray(value) && value.length === 0) {
      c.warn(key, key, `"${key}" is an empty array.`, "Remove the empty property or populate it.");
    }
  }
}
