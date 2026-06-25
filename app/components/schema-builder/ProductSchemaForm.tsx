import { useRef, useEffect, useState } from "react";
import type { elements } from "@shopify/polaris-types";
import type { ProductSchemaData, ValidationError, ShopifyProduct } from "../../types/schema-builder";
import { getFieldError } from "../../services/schema/validators";

interface ProductSchemaFormProps {
  data: ProductSchemaData;
  onChange: (data: ProductSchemaData) => void;
  errors: ValidationError[];
  products: ShopifyProduct[];
  shopDomain: string;
}

const AVAILABILITY_OPTIONS = [
  { value: "InStock", label: "In Stock" },
  { value: "OutOfStock", label: "Out of Stock" },
  { value: "PreOrder", label: "Pre-Order" },
  { value: "LimitedAvailability", label: "Limited Availability" },
];

export function ProductSchemaForm({ data, onChange, errors, products, shopDomain }: ProductSchemaFormProps) {
  const availabilityRef = useRef<InstanceType<typeof elements.Select>>(null);
  const autoFillRef = useRef<InstanceType<typeof elements.Select>>(null);
  // Tracks the last auto-filled product so `key` forces s-select / s-text-field
  // to remount and pick up the new `value` prop (web components only read the
  // `value` attribute on first connection; a key change triggers a fresh mount).
  const [selectedProductId, setSelectedProductId] = useState("");

  useEffect(() => {
    const el = availabilityRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<{ value: string }>).detail?.value ?? (e.target as HTMLSelectElement).value;
      onChange({ ...data, availability: val as ProductSchemaData["availability"] });
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  });

  useEffect(() => {
    const el = autoFillRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      const val = (e as CustomEvent<{ value: string }>).detail?.value ?? (e.target as HTMLSelectElement).value;
      if (!val) return;
      const product = products.find((p) => p.id === val);
      if (!product) return;
      // Shopify Admin GraphQL returns the amount in the currency's smallest unit
      // (e.g. 29999 for ₹299.99 or $299.99). Divide by 100 to get the decimal value.
      const rawAmount = parseFloat(product.priceRange.minVariantPrice.amount);
      const price = isNaN(rawAmount) ? "" : (rawAmount / 100).toFixed(2);
      setSelectedProductId(val);
      onChange({
        ...data,
        name: product.title,
        url: product.onlineStoreUrl ?? `${shopDomain}/products/${product.handle}`,
        price,
        currency: product.priceRange.minVariantPrice.currencyCode,
        image: product.featuredImage?.url ?? "",
        brand: product.vendor,
        sku: product.variants.nodes[0]?.sku ?? "",
        description: product.description,
        // null totalInventory means inventory isn't tracked → treat as in stock
        availability: (product.totalInventory === null || product.totalInventory > 0) ? "InStock" : "OutOfStock",
      });
    };
    el.addEventListener("change", handler);
    return () => el.removeEventListener("change", handler);
  });

  const field = (key: keyof ProductSchemaData) => (e: Event) => {
    onChange({ ...data, [key]: (e.target as HTMLInputElement).value });
  };

  return (
    <s-stack direction="block" gap="base">
      {products.length > 0 && (
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small">
            <s-text type="strong">Auto-fill from Shopify</s-text>
            <s-select ref={autoFillRef} label="Select a product" value="">
              <s-option value="">— choose a product —</s-option>
              {products.map((p) => (
                <s-option key={p.id} value={p.id}>
                  {p.title}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-box>
      )}

      <s-text-field
        label="Product Name"
        value={data.name}
        error={getFieldError("name", errors)}
        required
        details="The full name of your product"
        onInput={field("name")}
      />

      <s-text-field
        label="Product URL"
        value={data.url}
        error={getFieldError("url", errors)}
        required
        details="The full URL to your product page"
        onInput={field("url")}
      />

      <s-grid gridTemplateColumns="1fr 1fr" gap="small">
        <s-grid-item>
          <s-text-field
            label="Price"
            value={data.price}
            error={getFieldError("price", errors)}
            required
            details="Numeric price without currency symbol"
            onInput={field("price")}
          />
        </s-grid-item>
        <s-grid-item>
          {/* key forces remount on product change so the web component reads the new value */}
          <s-text-field
            key={`currency-${selectedProductId}`}
            label="Currency Code"
            value={data.currency}
            details="ISO 4217 code (e.g. USD, GBP)"
            onInput={field("currency")}
          />
        </s-grid-item>
      </s-grid>

      {/* key forces remount on product change so the web component reads the new value */}
      <s-select key={`availability-${selectedProductId}`} ref={availabilityRef} label="Availability" value={data.availability}>
        {AVAILABILITY_OPTIONS.map((opt) => (
          <s-option key={opt.value} value={opt.value}>
            {opt.label}
          </s-option>
        ))}
      </s-select>

      <s-text-field
        label="Brand"
        value={data.brand}
        details="The brand or manufacturer of the product"
        onInput={field("brand")}
      />

      <s-text-field
        label="SKU"
        value={data.sku}
        details="Stock keeping unit identifier"
        onInput={field("sku")}
      />

      <s-text-field
        label="Product Image URL"
        value={data.image}
        details="Full URL to the main product image"
        onInput={field("image")}
      />

      <s-text-area
        label="Description"
        value={data.description}
        details="A brief description of the product"
        rows={4}
        onInput={field("description")}
      />
    </s-stack>
  );
}
