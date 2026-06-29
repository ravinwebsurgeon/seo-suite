import { useState, useMemo, useCallback } from "react";
import type { LoaderFunctionArgs, HeadersFunction } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";

import { authenticate } from "../shopify.server";
import {
  fetchProductsForSchema,
  fetchArticlesForSchema,
  fetchShopDomain,
} from "../services/shopify/schema-data.server";
import {
  generateProductSchema,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  schemaToScriptTag,
} from "../services/schema/schema-generator";
import { generateProductLiquidSnippet } from "../services/schema/liquid-generator";
import {
  validateProduct,
  validateArticle,
  validateBreadcrumb,
  validateFAQ,
} from "../services/schema/validators";

import { SchemaTypeSelector } from "../components/schema-builder/SchemaTypeSelector";
import { ProductSchemaForm } from "../components/schema-builder/ProductSchemaForm";
import { ArticleSchemaForm } from "../components/schema-builder/ArticleSchemaForm";
import { BreadcrumbSchemaForm } from "../components/schema-builder/BreadcrumbSchemaForm";
import { FAQSchemaForm } from "../components/schema-builder/FAQSchemaForm";
import { JsonPreview } from "../components/schema-builder/JsonPreview";
import { LiquidPreview } from "../components/schema-builder/LiquidPreview";

import type {
  SchemaType,
  ProductSchemaData,
  ArticleSchemaData,
  BreadcrumbSchemaData,
  FAQSchemaData,
  ValidationError,
} from "../types/schema-builder";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  // articles requires the read_content scope — catch gracefully if not granted
  const [products, articlesResult, shopDomain] = await Promise.all([
    fetchProductsForSchema(admin),
    fetchArticlesForSchema(admin).catch(() => []),
    fetchShopDomain(admin),
  ]);

  return { products, articles: articlesResult, shopDomain };
};

// ─── Default form states ──────────────────────────────────────────────────────

const DEFAULT_PRODUCT: ProductSchemaData = {
  name: "",
  url: "",
  price: "",
  currency: "USD",
  image: "",
  brand: "",
  sku: "",
  availability: "InStock",
  description: "",
};

const DEFAULT_ARTICLE: ArticleSchemaData = {
  headline: "",
  url: "",
  publishedDate: "",
  author: "",
  imageUrl: "",
  description: "",
};

const DEFAULT_BREADCRUMB: BreadcrumbSchemaData = { items: [] };

const DEFAULT_FAQ: FAQSchemaData = { items: [] };

// ─── Component ────────────────────────────────────────────────────────────────

export default function SchemaBuilder() {
  const { products, articles, shopDomain } = useLoaderData<typeof loader>();
  const shopify = useAppBridge();

  const [activeSchema, setActiveSchema] = useState<SchemaType>("product");
  const [productData, setProductData] = useState<ProductSchemaData>(DEFAULT_PRODUCT);
  const [articleData, setArticleData] = useState<ArticleSchemaData>(DEFAULT_ARTICLE);
  const [breadcrumbData, setBreadcrumbData] = useState<BreadcrumbSchemaData>(DEFAULT_BREADCRUMB);
  const [faqData, setFaqData] = useState<FAQSchemaData>(DEFAULT_FAQ);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [showLiquid, setShowLiquid] = useState(false);
  const [validated, setValidated] = useState(false);

  // ── Live JSON-LD generation ──────────────────────────────────────────────

  const schema = useMemo(() => {
    switch (activeSchema) {
      case "product":
        return generateProductSchema(productData);
      case "article":
        return generateArticleSchema(articleData);
      case "breadcrumb":
        return generateBreadcrumbSchema(breadcrumbData);
      case "faq":
        return generateFAQSchema(faqData);
    }
  }, [activeSchema, productData, articleData, breadcrumbData, faqData]);

  // ── Validation on tab switch / manual trigger ────────────────────────────

  const validate = useCallback((): boolean => {
    let errs: ValidationError[] = [];
    switch (activeSchema) {
      case "product":
        errs = validateProduct(productData);
        break;
      case "article":
        errs = validateArticle(articleData);
        break;
      case "breadcrumb":
        errs = validateBreadcrumb(breadcrumbData);
        break;
      case "faq":
        errs = validateFAQ(faqData);
        break;
    }
    setErrors(errs);
    return errs.length === 0;
  }, [activeSchema, productData, articleData, breadcrumbData, faqData]);

  // Clear errors when data changes (show errors only after first validation attempt)
  const handleSchemaChange = useCallback((type: SchemaType) => {
    setActiveSchema(type);
    setErrors([]);
    setValidated(false);
    setShowLiquid(false);
  }, []);

  // ── Copy to clipboard ────────────────────────────────────────────────────

  const handleCopyJson = useCallback(async () => {
    if (!validate()) {
      shopify.toast.show("Please fix validation errors before copying", { isError: true });
      setValidated(true);
      return;
    }
    try {
      await navigator.clipboard.writeText(schemaToScriptTag(schema));
      shopify.toast.show("JSON-LD copied to clipboard");
    } catch {
      shopify.toast.show("Failed to copy to clipboard", { isError: true });
    }
  }, [schema, validate, shopify]);

  const handleCopyLiquid = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(generateProductLiquidSnippet());
      shopify.toast.show("Liquid snippet copied to clipboard");
    } catch {
      shopify.toast.show("Failed to copy to clipboard", { isError: true });
    }
  }, [shopify]);

  // ── Download ─────────────────────────────────────────────────────────────

  const handleDownload = useCallback(() => {
    if (!validate()) {
      shopify.toast.show("Please fix validation errors before downloading", { isError: true });
      setValidated(true);
      return;
    }
    const content = JSON.stringify(schema, null, 2);
    const blob = new Blob([content], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "schema.json";
    link.click();
    URL.revokeObjectURL(url);
  }, [schema, validate, shopify]);

  // ── Google Rich Results ──────────────────────────────────────────────────

  const handleValidate = useCallback(() => {
    window.open("https://search.google.com/test/rich-results", "_blank", "noopener,noreferrer");
  }, []);

  // ── Liquid preview toggle ────────────────────────────────────────────────

  const handleToggleLiquid = useCallback(() => {
    setShowLiquid((prev) => !prev);
  }, []);

  // Re-validate live after first submit attempt
  const handleProductChange = useCallback(
    (d: ProductSchemaData) => {
      setProductData(d);
      if (validated) setErrors(validateProduct(d));
    },
    [validated],
  );

  const handleArticleChange = useCallback(
    (d: ArticleSchemaData) => {
      setArticleData(d);
      if (validated) setErrors(validateArticle(d));
    },
    [validated],
  );

  const handleBreadcrumbChange = useCallback(
    (d: BreadcrumbSchemaData) => {
      setBreadcrumbData(d);
      if (validated) setErrors(validateBreadcrumb(d));
    },
    [validated],
  );

  const handleFaqChange = useCallback(
    (d: FAQSchemaData) => {
      setFaqData(d);
      if (validated) setErrors(validateFAQ(d));
    },
    [validated],
  );

  const hasErrors = errors.length > 0;

  return (
    <s-page heading="Schema Markup Builder">
      <s-button
        slot="primary-action"
        variant="primary"
        onClick={() => {
          setValidated(true);
          if (validate()) {
            shopify.toast.show("Schema is valid — ready to copy or download");
          }
        }}
      >
        Validate Schema
      </s-button>

      {/* ── Schema type selector ── */}
      <s-section heading="Schema Type">
        <s-paragraph>
          Select the type of structured data you want to generate. Each type targets a different
          Google Rich Result.
        </s-paragraph>
        <SchemaTypeSelector selected={activeSchema} onChange={handleSchemaChange} />
      </s-section>

      {/* ── Validation banner ── */}
      {hasErrors && validated && (
        <s-section>
          <s-banner tone="critical">
            <s-stack direction="block" gap="small">
              <s-text type="strong">Validation errors</s-text>
              {errors.map((err) => (
                <s-paragraph key={err.field}>• {err.message}</s-paragraph>
              ))}
            </s-stack>
          </s-banner>
        </s-section>
      )}

      {/* ── Two-column layout: form left, preview right ── */}
      <s-section>
        <s-grid gridTemplateColumns="1fr 1fr" gap="base">
          {/* Left – configuration panel */}
          <s-grid-item>
            <s-stack direction="block" gap="base">
              <s-heading>
                {activeSchema === "product" && "Product Details"}
                {activeSchema === "article" && "Article Details"}
                {activeSchema === "breadcrumb" && "Breadcrumb Items"}
                {activeSchema === "faq" && "FAQ Pairs"}
              </s-heading>

              {activeSchema === "product" && (
                <ProductSchemaForm
                  data={productData}
                  onChange={handleProductChange}
                  errors={errors}
                  products={products}
                  shopDomain={shopDomain}
                />
              )}

              {activeSchema === "article" && (
                <ArticleSchemaForm
                  data={articleData}
                  onChange={handleArticleChange}
                  errors={errors}
                  articles={articles}
                  shopDomain={shopDomain}
                />
              )}

              {activeSchema === "breadcrumb" && (
                <BreadcrumbSchemaForm
                  data={breadcrumbData}
                  onChange={handleBreadcrumbChange}
                  errors={errors}
                  storeUrl={shopDomain}
                />
              )}

              {activeSchema === "faq" && (
                <FAQSchemaForm
                  data={faqData}
                  onChange={handleFaqChange}
                  errors={errors}
                />
              )}

              {/* Liquid snippet toggle — Product only */}
              {activeSchema === "product" && (
                <s-button variant="secondary" onClick={handleToggleLiquid}>
                  {showLiquid ? "Hide Liquid Snippet" : "Generate Liquid Snippet"}
                </s-button>
              )}
            </s-stack>
          </s-grid-item>

          {/* Right – live preview panel */}
          <s-grid-item>
            <s-stack direction="block" gap="base">
              <JsonPreview
                schema={schema}
                onCopy={handleCopyJson}
                onDownload={handleDownload}
                onValidate={handleValidate}
              />

              {activeSchema === "product" && showLiquid && (
                <LiquidPreview
                  snippet={generateProductLiquidSnippet()}
                  onCopy={handleCopyLiquid}
                />
              )}
            </s-stack>
          </s-grid-item>
        </s-grid>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
