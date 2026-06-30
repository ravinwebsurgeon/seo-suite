We are working on the Product Sales Intelligence module of our Shopify app (SEO Suite).

Currently the module fails with:

"This app is not approved to access the Order object."

This happens because the app does not yet have Shopify Protected Customer Data (PCD) approval for the Order object.

Your task is NOT to bypass Shopify restrictions.

Instead, refactor the module to gracefully handle this situation.

Requirements:

1. Detect when the Shopify API denies access because of missing Protected Customer Data approval.

2. Do NOT show a generic "Something went wrong" page.

3. Instead, display a professional empty state explaining:

- Product Sales Intelligence requires access to Shopify Orders.
- The current app has not yet been granted permission.
- Once Protected Customer Data access is approved, this module will automatically function.

4. If the error is caused by another issue (network, GraphQL, server error, etc.), continue showing the normal error UI.

5. Separate "Permission Error" from "Application Error".

6. Refactor the backend so permission errors return a dedicated error code instead of a generic 500 response.

Example:

{
  success: false,
  errorType: "PCD_PERMISSION_REQUIRED",
  message: "...",
}

7. Update the frontend to recognize this errorType and render the appropriate UI.

8. Make sure the rest of the application continues working normally.

9. Review the implementation and identify exactly which GraphQL queries require Order access.

10. Document which Shopify scopes and Protected Customer Data approvals are required for this module.

11. Ensure the code is production-ready so that once Shopify grants approval, no additional code changes are required.

Do not attempt to work around Shopify's Protected Customer Data restrictions. Instead, improve the user experience and architecture for this expected permission state.