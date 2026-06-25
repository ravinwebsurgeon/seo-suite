import { useRef, useEffect } from "react";
import type { elements } from "@shopify/polaris-types";
import type { ArticleSchemaData, ValidationError, ShopifyArticle } from "../../types/schema-builder";
import { getFieldError } from "../../services/schema/validators";

interface ArticleSchemaFormProps {
  data: ArticleSchemaData;
  onChange: (data: ArticleSchemaData) => void;
  errors: ValidationError[];
  articles: ShopifyArticle[];
  shopDomain: string;
}

export function ArticleSchemaForm({ data, onChange, errors, articles, shopDomain }: ArticleSchemaFormProps) {
  const autoFillRef = useRef<InstanceType<typeof elements.Select>>(null);

  useEffect(() => {
    const el = autoFillRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<{ value: string }>).detail?.value ?? (e.target as HTMLSelectElement).value;
      if (!val) return;
      const article = articles.find((a) => a.id === val);
      if (!article) return;
      const url = `${shopDomain}/blogs/${article.blog.handle}/${article.handle}`;
      onChange({
        ...data,
        headline: article.title,
        url,
        publishedDate: article.publishedAt ? article.publishedAt.substring(0, 10) : "",
      });
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  });

  const field = (key: keyof ArticleSchemaData) => (e: Event) => {
    onChange({ ...data, [key]: (e.target as HTMLInputElement).value });
  };

  return (
    <s-stack direction="block" gap="base">
      {articles.length > 0 && (
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small">
            <s-text type="strong">Auto-fill from Shopify</s-text>
            <s-select ref={autoFillRef} label="Select an article" value="">
              <s-option value="">— choose an article —</s-option>
              {articles.map((a) => (
                <s-option key={a.id} value={a.id}>
                  {a.title}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-box>
      )}

      <s-text-field
        label="Headline"
        value={data.headline}
        error={getFieldError("headline", errors)}
        required
        details="The title of your article"
        onInput={field("headline")}
      />

      <s-text-field
        label="Article URL"
        value={data.url}
        details="Full URL to the article page"
        onInput={field("url")}
      />

      <s-text-field
        label="Published Date"
        value={data.publishedDate}
        error={getFieldError("publishedDate", errors)}
        required
        details="Publication date in YYYY-MM-DD format"
        onInput={field("publishedDate")}
      />

      <s-text-field
        label="Author"
        value={data.author}
        details="Full name of the article author"
        onInput={field("author")}
      />

      <s-text-field
        label="Image URL"
        value={data.imageUrl}
        details="Full URL to the article featured image"
        onInput={field("imageUrl")}
      />

      <s-text-area
        label="Description"
        value={data.description}
        details="A brief summary of the article"
        rows={4}
        onInput={field("description")}
      />
    </s-stack>
  );
}
