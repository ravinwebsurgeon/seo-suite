I need help debugging the Bulk Meta Generator / Editor module in my Shopify app.

## Issue Summary

The filtering functionality is returning incorrect results.

### Status Filter Problems

I have many products in the database whose status is clearly set to:

* pending
* generated
* approved
* rejected
* published

* Missing Title
* Missing Description
* Missing both

However, when I click certain status filters, the results are incorrect.

Example:

* There are multiple products with status = `pending`
* When I select the **Pending** filter, the UI shows:

"No records found"

"Try adjusting your filters or search query."

The same problem occurs for other status filters as well. Some filters return incorrect counts or incorrect products.

---

### Missing SEO Filters Problems

The following filters are also producing incorrect results:

* Missing Title
* Missing Description
* Missing Both

Examples:

#### Missing Title

Expected:
Return products where SEO title is null, undefined, or empty.

Actual:
Products with existing titles are sometimes included, and products without titles are sometimes excluded.

#### Missing Description

Expected:
Return products where meta description is null, undefined, or empty.

Actual:
Incorrect products are returned.

#### Missing Both

Expected:
Return only products where BOTH title and description are missing.

Actual:
Results do not match the actual database values.

---

## Investigation Required

Please perform a full debugging investigation.

### Check Frontend

Inspect:

* filter state management
* selected filter value
* URL search params
* React state updates
* filter tab click handlers
* API request payloads

Verify that the selected filter value is actually being sent correctly.

---

### Check Backend

Inspect:

* route loaders
* API endpoints
* query builders
* filtering functions
* search + filter combination logic

Verify that backend receives the expected filter values.

---

### Check Database Queries

I am using:

* PostgreSQL
* Drizzle ORM

Please inspect all Drizzle queries used by the Bulk Meta Generator.

Verify:

* WHERE clauses
* AND conditions
* OR conditions
* status comparisons
* null handling
* empty string handling

Check for mistakes such as:

status = 'Pending'
vs
status = 'pending'

or

NULL
vs
''

or

undefined values.

---

### Verify Status Values

Please determine:

1. What status values are actually stored in the database.
2. What status values the frontend expects.
3. Whether there is a mismatch.

For example:

Database:

pending

Frontend filter:

Pending

or

PENDING

which would break exact matching.

---

### Verify Missing SEO Logic

Check how the code defines:

* Missing Title
* Missing Description
* Missing Both

Ensure it correctly handles:

NULL

''

undefined

whitespace-only strings

For example:

title IS NULL
OR title = ''
OR trim(title) = ''

and similarly for descriptions.

---

### Check Counts

If filter tabs display counts, verify that:

* count queries
* table queries

use the exact same filtering logic.

A common bug is that tab counts are calculated differently from table results.

---

### Deliverables

Please provide:

1. Root cause(s) of the incorrect filtering.
2. Exact files involved.
3. Exact code changes required.
4. Correct Drizzle query implementation.
5. Correct frontend filter implementation.
6. Any database inconsistencies found.
7. Any status value normalization required.
8. Any test cases that should be added to prevent future regressions.

Do not guess. Trace the filter value from UI → API → Drizzle query → Database results and identify where the mismatch occurs.
