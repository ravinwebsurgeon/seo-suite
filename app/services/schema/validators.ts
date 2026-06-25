import type {
  ProductSchemaData,
  ArticleSchemaData,
  BreadcrumbSchemaData,
  FAQSchemaData,
  ValidationError,
} from "../../types/schema-builder";

export function validateProduct(data: ProductSchemaData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.name.trim()) errors.push({ field: "name", message: "Product name is required" });
  if (!data.price.trim()) errors.push({ field: "price", message: "Price is required" });
  if (!data.url.trim()) errors.push({ field: "url", message: "Product URL is required" });
  return errors;
}

export function validateArticle(data: ArticleSchemaData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.headline.trim()) errors.push({ field: "headline", message: "Headline is required" });
  if (!data.publishedDate.trim()) errors.push({ field: "publishedDate", message: "Published date is required" });
  return errors;
}

export function validateBreadcrumb(data: BreadcrumbSchemaData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (data.items.length === 0) {
    errors.push({ field: "items", message: "At least one breadcrumb item is required" });
    return errors;
  }
  data.items.forEach((item, i) => {
    if (!item.name.trim()) errors.push({ field: `name_${i}`, message: `Item ${i + 1}: label is required` });
    if (!item.url.trim()) errors.push({ field: `url_${i}`, message: `Item ${i + 1}: URL is required` });
  });
  return errors;
}

export function validateFAQ(data: FAQSchemaData): ValidationError[] {
  const errors: ValidationError[] = [];
  if (data.items.length === 0) {
    errors.push({ field: "items", message: "At least one FAQ pair is required" });
    return errors;
  }
  data.items.forEach((item, i) => {
    if (!item.question.trim()) errors.push({ field: `question_${i}`, message: `FAQ ${i + 1}: question cannot be empty` });
    if (!item.answer.trim()) errors.push({ field: `answer_${i}`, message: `FAQ ${i + 1}: answer cannot be empty` });
  });
  return errors;
}

export function getFieldError(field: string, errors: ValidationError[]): string | undefined {
  return errors.find((e) => e.field === field)?.message;
}
