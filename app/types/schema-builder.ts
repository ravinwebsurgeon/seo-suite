export type SchemaType = "product" | "article" | "breadcrumb" | "faq";

export type ProductAvailability =
  | "InStock"
  | "OutOfStock"
  | "PreOrder"
  | "LimitedAvailability";

export interface ProductSchemaData {
  name: string;
  url: string;
  price: string;
  currency: string;
  image: string;
  brand: string;
  sku: string;
  availability: ProductAvailability;
  description: string;
}

export interface ArticleSchemaData {
  headline: string;
  url: string;
  publishedDate: string;
  author: string;
  imageUrl: string;
  description: string;
}

export interface BreadcrumbItem {
  id: string;
  name: string;
  url: string;
}

export interface BreadcrumbSchemaData {
  items: BreadcrumbItem[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface FAQSchemaData {
  items: FAQItem[];
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  onlineStoreUrl: string | null;
  totalInventory: number | null;
  vendor: string;
  description: string;
  featuredImage: { url: string } | null;
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: {
    nodes: Array<{ sku: string }>;
  };
}

export interface ShopifyArticle {
  id: string;
  title: string;
  handle: string;
  publishedAt: string | null;
  blog: { handle: string };
}
