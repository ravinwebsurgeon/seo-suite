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




and also make sure to use below given stack where need -

Core Stack-

Framework-
React Router 7 (Shopify App Template)
Use file-based routing.
Use loaders and actions for server-side operations.
Follow Shopify embedded app architecture.
Keep routes modular and feature-based.

UI Layer -
Shopify Polaris only.
Use Polaris components before creating custom UI.
Follow Shopify design guidelines.
Ensure responsive layouts for desktop and tablet merchants.

Authentication - 
Shopify OAuth provided by Shopify App Template.
Use existing session management from the template.
Do not create custom authentication unless explicitly required.

Shopify Integration -
Use Shopify Admin GraphQL API (2025-01).
Prefer GraphQL over REST.
Use typed queries and mutations.
All Shopify data reads and writes must go through the Admin API.

AI Layer - 
Claude API (claude-sonnet-4-6).
AI is responsible for:
 SEO meta title generation
 Meta description generation
 Product description optimization
 Alt text generation
 Structured data suggestions
 SEO recommendations
Use structured prompts.
Validate and sanitize AI output before storing.

Queue System - 
BullMQ
Redis
Use queues for:
 Bulk SEO generation
 Bulk alt text generation
 Long-running AI operations
 Background processing
Never execute large bulk jobs synchronously.

Database - 
PostgreSQL
Drizzle ORM
Store:
 Keywords
 AI generations
 Job status
 Processing history
 User settings
 Cache records
Use migrations through Drizzle.
Use typed schemas for all tables.

Hosting -
Railway
Services:
 React Router application
 PostgreSQL database
 Redis instance
Use environment variables for all secrets.
 
Language -
TypeScript (Strict Mode)
No JavaScript files unless unavoidable.
Avoid using any.
Use proper interfaces and types.
Prefer type inference where appropriate.