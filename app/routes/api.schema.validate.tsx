import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { fetchProductForValidation } from "../services/shopify/schema-data.server";
import { generateProductSchema } from "../services/schema/schema-generator";
import { validateSchema } from "../services/schema/validators";
import type { SchemaType, ProductSchemaData } from "../types/schema-builder";
import type { ProductValidationContext } from "../types/schema-validation";

// ─── POST /api/schema/validate ────────────────────────────────────────────────
//
// Server-side / programmatic entry point to the Schema Validation Engine.
//
// Request body (JSON), either:
//   { "schemaType": "product", "productId": "gid://shopify/Product/123" }
//     → fetches the product, generates its JSON-LD and validates it, including
//       the advanced consistency checks (inventory vs availability, compare-at).
//   { "schemaType": "product", "schema": { ...raw JSON-LD... } }
//     → validates the supplied JSON-LD directly (any supported type).
//
// Response: the structured SchemaValidationResult.

const SUPPORTED: SchemaType[] = ["product", "article", "faq", "breadcrumb"];

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { admin } = await authenticate.admin(request);

  let body: {
    schemaType?: string;
    productId?: string;
    schema?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const schemaType = String(body.schemaType ?? "").toLowerCase() as SchemaType;
  if (!SUPPORTED.includes(schemaType)) {
    return json(
      { error: `Unsupported schemaType. Supported: ${SUPPORTED.join(", ")}` },
      400,
    );
  }

  // 1) Direct validation of a supplied JSON-LD object.
  if (body.schema && typeof body.schema === "object") {
    return json(validateSchema(schemaType, body.schema));
  }

  // 2) Product-by-id: fetch, generate, validate (with advanced context).
  if (schemaType === "product") {
    if (!body.productId) {
      return json({ error: "productId or schema is required" }, 400);
    }

    const product = await fetchProductForValidation(admin, body.productId);
    if (!product) {
      return json({ error: "Product not found" }, 404);
    }

    // Mirror the Schema Builder's auto-fill transform so the validated schema
    // matches what a merchant sees in the UI.
    const rawAmount = parseFloat(product.priceRange.minVariantPrice.amount);
    const price = Number.isNaN(rawAmount) ? "" : (rawAmount / 100).toFixed(2);
    const rawCompareAt = product.variants.nodes[0]?.compareAtPrice
      ? parseFloat(product.variants.nodes[0].compareAtPrice)
      : NaN;

    const productData: ProductSchemaData = {
      name: product.title,
      url: product.onlineStoreUrl ?? `https://${product.handle}`,
      price,
      currency: product.priceRange.minVariantPrice.currencyCode,
      image: product.featuredImage?.url ?? "",
      brand: product.vendor,
      sku: product.variants.nodes[0]?.sku ?? "",
      availability:
        product.totalInventory === null || product.totalInventory > 0
          ? "InStock"
          : "OutOfStock",
      description: product.description,
    };

    const schema = generateProductSchema(productData);
    const context: ProductValidationContext = {
      inventory: product.totalInventory,
      compareAtPrice: Number.isNaN(rawCompareAt) ? null : rawCompareAt / 100,
    };

    return json(validateSchema("product", schema, { product: context }));
  }

  return json(
    { error: "For non-product types, supply a `schema` object to validate." },
    400,
  );
};
