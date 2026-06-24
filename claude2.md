In the SEO Suite app, within the **Dead Collection Cleaner** module, there is an issue with the **"Assign to Collection"** dropdown used for orphan products.

### Current Behavior

1. User selects a valid collection from the dropdown.
2. The **Save** button becomes enabled (this is correct).
3. User then changes the dropdown back to the default option **"Choose a Collection"** (which has no collection value associated with it).
4. The **Save** button remains enabled (this is incorrect).
5. Clicking **Save** submits the form and triggers a Shopify GraphQL error:

```txt
Error: Variable $id of type ID! was provided invalid value
```

This happens because an empty, null, or invalid collection ID is being sent to the Shopify mutation.

### Expected Behavior

1. The **Save** button should only be enabled when a valid collection is selected.
2. If the user selects or re-selects the default **"Choose a Collection"** option, the Save button should immediately become disabled.
3. Form submission should be prevented when no valid collection is selected.
4. Server-side validation should also be added as a safeguard to ensure a valid collection ID exists before calling the Shopify API.

### Tasks

* Investigate the dropdown state management.
* Ensure the Save button's disabled state reacts correctly when the selected collection changes back to the default option.
* Add proper frontend validation for empty/default selections.
* Add backend validation before executing the Shopify GraphQL mutation.
* Prevent Shopify API calls when collectionId is empty, null, or invalid.
* Verify that the issue is resolved by testing:

  * Select collection → Save enabled.
  * Revert to "Choose a Collection" → Save disabled.
  * Attempt submission without a collection → validation message/no API call.
  * No GraphQL error should occur.
