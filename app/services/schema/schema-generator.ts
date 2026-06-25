import type {
  ProductSchemaData,
  ArticleSchemaData,
  BreadcrumbSchemaData,
  FAQSchemaData,
} from "../../types/schema-builder";

export function generateProductSchema(data: ProductSchemaData): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: data.name,
  };

  if (data.description) schema.description = data.description;
  if (data.image) schema.image = data.image;
  if (data.brand) schema.brand = { "@type": "Brand", name: data.brand };
  if (data.sku) schema.sku = data.sku;

  schema.offers = {
    "@type": "Offer",
    url: data.url,
    price: data.price,
    priceCurrency: data.currency || "USD",
    availability: `https://schema.org/${data.availability}`,
  };

  return schema;
}

export function generateArticleSchema(data: ArticleSchemaData): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: data.headline,
    datePublished: data.publishedDate,
  };

  if (data.url) schema.url = data.url;
  if (data.description) schema.description = data.description;
  if (data.author) schema.author = { "@type": "Person", name: data.author };
  if (data.imageUrl) schema.image = data.imageUrl;

  return schema;
}

export function generateBreadcrumbSchema(data: BreadcrumbSchemaData): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: data.items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateFAQSchema(data: FAQSchemaData): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: data.items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export function schemaToScriptTag(schema: Record<string, unknown>): string {
  return `<script type="application/ld+json">\n${JSON.stringify(schema, null, 2)}\n</script>`;
}
