# Product Sales Intelligence Module

## Feature Overview

Build a production-ready Shopify Embedded App module called **Product Sales Intelligence** as part of the SEO Suite application.

The goal of this module is to provide merchants with actionable sales insights directly inside Shopify Admin.

The module should analyze order history, sales performance, and inventory levels to help merchants:

* Identify best-selling products.
* Identify products receiving no sales.
* Identify products at risk of going out of stock.
* Make better inventory purchasing decisions.
* Optimize marketing spend.
* Reduce dead inventory.
* Prevent stockouts.

This module is analytics-focused and does not use AI.

---

## Tech Stack

* React Router 7
* TypeScript
* Shopify Polaris
* Shopify Admin GraphQL API
* PostgreSQL
* Drizzle ORM

No Claude AI required.

No BullMQ required for V1.

---

## Data Sources

### Orders

Fetch:

* Order ID
* Created At
* Line Items
* Product ID
* Variant ID
* Quantity
* Total Sales

Used to calculate:

* Units sold
* Revenue
* Sales velocity

### Products

Fetch:

* Product ID
* Product Title
* Variant Title
* Inventory Quantity
* Created At
* Status

Used for:

* Inventory analysis
* Stock calculations
* Zero-sale detection

### Optional

If available on merchant plan:

Use Shopify Analytics API for aggregated sales reporting.

Fallback to Orders API if Analytics API is unavailable.

---

# Global Date Range Filter

Provide a date range picker at the top of the page.

Supported presets:

* Last 7 Days
* Last 30 Days
* Last 90 Days
* Custom Range

Date range applies to all reports.

Reports should refresh on demand.

No real-time polling.

---

# Dashboard Overview

Display summary cards:

### Sales Metrics

* Total Revenue
* Total Orders
* Total Units Sold
* Average Order Value

### Product Metrics

* Best Seller Count
* Zero Sale Count
* High Demand Count

---

# Core View 1: Best Sellers

Purpose:

Show products generating the most sales.

Calculation:

Rank products by units sold during selected date range.

Display:

* Product Title
* Variant
* Revenue
* Units Sold
* Percentage of Total Revenue
* Inventory Remaining

Sorting:

* Revenue
* Units Sold
* Inventory
* Revenue %

Default Sort:

Highest Units Sold

Use Cases:

* Reorder inventory
* Increase advertising budget
* Feature top products
* Create bundles

---

# Core View 2: Zero Sale Products

Purpose:

Identify products with no sales during selected period.

Logic:

Products with:

Units Sold = 0

during selected date range.

Display:

* Product Title
* Inventory Level
* Product Created Date
* Last Sale Date
* Days Since Last Sale

Actions:

* Mark For Discount
* Archive Product
* Add To Clearance Collection

Use Cases:

* Inventory cleanup
* Clearance campaigns
* Reduce storage costs

---

# Core View 3: High Demand / Low Stock

Purpose:

Identify products likely to go out of stock soon.

Calculation:

Sales Velocity Formula:

(units sold in last 14 days) / inventory quantity

Default Threshold:

0.5

If result exceeds threshold:

Product should be flagged.

Example:

Units Sold Last 14 Days = 50

Inventory = 20

50 / 20 = 2.5

Flag Product.

Display:

* Product Title
* Inventory Quantity
* Units Sold Last 14 Days
* Sales Velocity
* Estimated Days Remaining

Estimated Days Remaining Formula:

inventory quantity /
(units sold in last 14 days / 14)

Use Cases:

* Restock planning
* Prevent stockouts
* Purchase order forecasting

---

# Additional Insights

Add optional dashboard widgets:

### Top Revenue Products

Rank by revenue generated.

### Recently Trending Products

Products with highest sales growth compared to previous period.

Example:

Current 30 Days vs Previous 30 Days.

### Inventory Health

Break products into:

* Healthy Stock
* Low Stock
* Critical Stock
* Out Of Stock

---

# Main Table Requirements

Use Polaris IndexTable.

Support:

* Sorting
* Filtering
* Pagination
* Search

Common Columns:

* Product
* Variant
* Revenue
* Units Sold
* Inventory
* Status
* Last Sale Date

---

# Export Functionality

Provide CSV Export for each report.

Best Sellers Export:

* Product
* Variant
* Revenue
* Units Sold
* Revenue Percentage

Zero Sale Export:

* Product
* Inventory
* Last Sale Date
* Days Since Last Sale

High Demand Export:

* Product
* Inventory
* Units Sold
* Velocity Score
* Estimated Days Remaining

---

# Database Cache

Create local cache tables to avoid recalculating reports repeatedly.

### sales_cache

Fields:

* id
* shop_id
* product_id
* variant_id
* units_sold
* revenue
* date_range
* created_at

### inventory_cache

Fields:

* id
* shop_id
* product_id
* inventory_quantity
* updated_at

Refresh cache when merchant requests new report data.

---

# Routes

/app/product-sales

/app/product-sales/dashboard

/app/product-sales/best-sellers

/app/product-sales/zero-sales

/app/product-sales/high-demand

---

# Polaris Components

Use:

* Page
* Layout
* Card
* IndexTable
* Tabs
* Filters
* DatePicker
* Badge
* Banner
* Tooltip
* Pagination
* Toast

Follow Shopify Embedded App UX standards.

---

# Required Shopify Scopes

read_orders

read_products

read_inventory

---

# Performance Requirements

Support stores with:

* 10,000+ products
* 100,000+ orders

Implement:

* Cursor pagination
* Server-side aggregation
* Efficient order processing
* PostgreSQL caching
* Lazy loading

Avoid loading all orders into memory.

---

# Error Handling

Handle:

### Shopify

* Rate limits
* Missing scopes
* Invalid responses

### Data Issues

* Missing inventory
* Deleted products
* Archived products

### Reporting

* Empty datasets
* Large date ranges

---

# Deliverables

Provide:

1. Complete architecture.
2. Folder structure.
3. Drizzle schema definitions.
4. Shopify GraphQL queries.
5. Service layer architecture.
6. Report calculation logic.
7. Polaris UI implementation.
8. Dashboard design.
9. CSV export implementation.
10. Scalable reporting strategy.

Build this as a SaaS-grade Shopify analytics module that gives merchants actionable product sales insights for inventory management, marketing decisions, and revenue optimization.
