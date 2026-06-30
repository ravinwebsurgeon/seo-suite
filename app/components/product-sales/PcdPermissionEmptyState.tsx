/**
 * Displayed on any Product Sales Intelligence page when Shopify has not yet
 * granted Protected Customer Data (PCD) access for the Order object.
 *
 * Once PCD approval is granted by Shopify, no code changes are needed —
 * the module will automatically start functioning.
 */
export function PcdPermissionEmptyState() {
  return (
    <s-section>
      <s-box padding="loose">
        <s-stack direction="block" gap="base" alignItems="center">
          <s-icon type="lock" size="large" />

          <s-stack direction="block" gap="small" alignItems="center">
            <s-heading>Order Access Required</s-heading>
            <s-text>
              <strong>Product Sales Intelligence</strong> requires access to Shopify Orders to
              calculate best sellers, zero-sale products, and high-demand inventory alerts.
            </s-text>
          </s-stack>

          <s-banner tone="warning" heading="Protected Customer Data Approval Pending">
            This app has not yet been granted permission to access the{" "}
            <strong>Order object</strong> through Shopify's Protected Customer Data (PCD) programme.
            This approval is managed by Shopify and cannot be bypassed.
          </s-banner>

          <s-stack direction="block" gap="small-200">
            <s-text>
              <strong>What happens next?</strong>
            </s-text>
            <s-list>
              <s-list-item>
                The app owner must apply for Protected Customer Data access in the Shopify Partner
                Dashboard under <em>App setup → Protected customer data access</em>.
              </s-list-item>
              <s-list-item>
                Shopify reviews the request. Approval typically takes a few business days.
              </s-list-item>
              <s-list-item>
                Once approved, this module will automatically start working — no additional
                configuration is required.
              </s-list-item>
            </s-list>
          </s-stack>

          <s-text tone="subdued" size="small">
            All other SEO Suite modules (Meta Generator, Schema Builder, Dead Collection Cleaner)
            are unaffected and continue to work normally.
          </s-text>
        </s-stack>
      </s-box>
    </s-section>
  );
}
