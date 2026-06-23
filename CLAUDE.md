You are a senior Shopify app developer.

Build the first module of a Shopify embedded app called SEO Suite using:

- React Router 7
- TypeScript
- Shopify Polaris
- Shopify Admin GraphQL API
- Shopify App Bridge
- Strict TypeScript

Module Name:
Dead Collection Cleaner

Requirements:

1. Dashboard page with stat cards:
   - Total Collections
   - Empty Collections
   - Broken Automated Collections
   - Orphan Products

2. Fetch collections using Shopify Admin GraphQL.

3. Detect:
   - Empty collections (productsCount = 0)
   - Broken automated collections (ruleSet exists but productsCount = 0)
   - Orphan products (products with no collections)

4. Create a sortable Polaris DataTable containing:
   - Collection name
   - Collection type
   - Product count
   - Last updated date

5. Add row selection and bulk actions:
   - Delete selected collections
   - Export CSV report

6. Create an orphan products table:
   - Product name
   - Current status
   - Assign collection dropdown
   - Save button

7. Add delete collection mutation support.

8. Add URL redirect creation modal before deletion.

9. Follow Shopify Polaris design patterns.

10. Separate code into:
   - routes
   - components
   - services/shopify
   - types

11. Return complete production-ready code with TypeScript types and GraphQL queries.

Generate all files with folder structure.