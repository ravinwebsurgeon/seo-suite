# SEO Suite – Schema Markup Builder

## Overview

Implement the **Schema Markup Builder** module for the Shopify embedded app **SEO Suite**.

This module should allow Shopify merchants to generate valid JSON-LD structured data through a user-friendly form interface without requiring technical knowledge of schema markup.

The module is part of a Shopify embedded app built with:

* React Router 7
* Shopify Polaris
* Shopify Admin GraphQL API
* TypeScript (strict mode)
* PostgreSQL + Drizzle ORM

No AI integration is required for this module.

---

## Objective

Create a form-driven schema generator that:

1. Supports multiple schema types.
2. Auto-populates available Shopify data.
3. Generates valid JSON-LD in real time.
4. Provides copy/export functionality.
5. Generates Shopify Liquid snippets for dynamic theme integration.
6. Includes validation and preview capabilities.

---

## Supported Schema Types

Implement support for the following schema types:

### 1. Product Schema

Auto-fill from Shopify product data:

* Product Name
* Product URL
* Product Price
* Currency
* Product Image

Merchant-editable fields:

* Brand
* SKU
* Availability
* Description

Generate valid JSON-LD Product schema.

---

### 2. Article Schema

Auto-fill where available:

* Article URL
* Headline
* Published Date

Merchant-editable fields:

* Author
* Image URL
* Description

Generate valid JSON-LD Article schema.

---

### 3. BreadcrumbList Schema

Auto-fill:

* Store URL

Merchant-entered:

* Dynamic breadcrumb items

  * Label
  * URL

Features:

* Add breadcrumb item
* Remove breadcrumb item
* Reorder breadcrumb items

Generate valid JSON-LD BreadcrumbList schema.

---

### 4. FAQ Schema

Merchant-entered:

* Question
* Answer

Features:

* Add FAQ pair
* Remove FAQ pair
* Multiple entries supported

Generate valid JSON-LD FAQPage schema.

---

# User Interface Requirements

## Page Layout

Use Polaris components and maintain consistency with existing SEO Suite modules.

Layout should contain:

### Left Side

Configuration panel:

* Schema Type Selector
* Dynamic Form Fields
* Validation Messages

### Right Side

Live Preview Panel:

* Formatted JSON-LD
* Syntax-highlighted code block
* Auto-updates as fields change

---

## Schema Type Selector

Implement either:

* Polaris Tabs

or

* Card-based selector

Supported options:

* Product
* Article
* BreadcrumbList
* FAQ

Switching schema types should dynamically load the appropriate form.

---

## Dynamic Forms

Each schema type should render only relevant fields.

Requirements:

* Proper labels
* Help text where necessary
* Required field indicators
* Inline validation

---

## Live JSON-LD Preview

As merchants edit fields:

* Regenerate JSON-LD instantly
* Pretty-print output
* Keep preview synchronized with form state

Display:

```json
{
  "@context": "https://schema.org",
  "@type": "Product"
}
```

with proper indentation.

---

## Output Features

### Copy JSON-LD

Button:

"Copy JSON-LD"

Copies:

```html
<script type="application/ld+json">
...
</script>
```

to clipboard.

Show success toast after copying.

---

### Download JSON-LD

Button:

"Download"

Downloads:

schema.json

containing generated JSON-LD.

---

### Generate Shopify Liquid Snippet

For Product Schema provide a second output option:

Generate Liquid code using Shopify variables.

Example:

```liquid
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "{{ product.title }}",
  "image": "{{ product.featured_image | image_url }}",
  "offers": {
    "@type": "Offer",
    "price": "{{ product.price | money_without_currency }}"
  }
}
</script>
```

Requirements:

* Use Shopify Liquid variables where appropriate.
* Generate production-ready snippets.
* Copy-to-clipboard support.

---

### Rich Results Validation

Provide a button:

"Validate in Google Rich Results Test"

Behavior:

* Opens Google Rich Results Test in a new tab.
* Merchant can validate their page URL.

Use:

https://search.google.com/test/rich-results

---

# Shopify Integration

Use Shopify Admin GraphQL where applicable.

Fetch data required for auto-fill:

Product:

* title
* handle
* onlineStoreUrl
* featuredImage
* price
* currency

Article:

* title
* handle
* publishedAt

Create reusable GraphQL utilities inside:

```text
app/services/shopify/
```

Keep GraphQL logic separate from UI components.

---

# Code Structure

Suggested structure:

```text
app/routes/app.schema-builder.tsx

app/components/schema-builder/
  SchemaTypeSelector.tsx
  ProductSchemaForm.tsx
  ArticleSchemaForm.tsx
  BreadcrumbSchemaForm.tsx
  FAQSchemaForm.tsx
  JsonPreview.tsx
  LiquidPreview.tsx

app/services/schema/
  schema-generator.ts
  liquid-generator.ts
  validators.ts

app/services/shopify/
  schema-data.server.ts
```

---

# Validation Requirements

Product:

* Name required
* Price required
* URL required

Article:

* Headline required
* Published Date required

Breadcrumb:

* Minimum 1 breadcrumb item

FAQ:

* At least 1 Question/Answer pair
* No empty questions
* No empty answers

Prevent generation if validation fails.

Display user-friendly Polaris error messages.

---

# Technical Requirements

* TypeScript strict mode
* Reusable schema generation utilities
* Reusable validation layer
* Clean component architecture
* Polaris-first UI
* Responsive design
* No AI integration
* No database storage required for v1

---

# Deliverables

Build a fully functional Schema Markup Builder module that includes:

1. Schema type selection.
2. Dynamic forms.
3. Live JSON-LD preview.
4. Product, Article, BreadcrumbList, and FAQ schema generation.
5. Copy-to-clipboard functionality.
6. Download functionality.
7. Liquid snippet generation.
8. Google Rich Results validation link.
9. Form validation and error handling.
10. Clean, maintainable TypeScript code following existing SEO Suite architecture.
