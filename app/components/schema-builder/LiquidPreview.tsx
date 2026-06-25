interface LiquidPreviewProps {
  snippet: string;
  onCopy: () => void;
}

export function LiquidPreview({ snippet, onCopy }: LiquidPreviewProps) {
  return (
    <s-stack direction="block" gap="small">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text type="strong">Shopify Liquid Snippet</s-text>
        <s-badge tone="warning">Theme Ready</s-badge>
      </s-stack>

      <s-banner tone="info">
        <s-paragraph>
          Copy this snippet into your Shopify theme (e.g.,{" "}
          <s-text type="strong">snippets/product-schema.liquid</s-text>) and include it with{" "}
          <s-text type="strong">{"{% render 'product-schema' %}"}</s-text> in your product template.
        </s-paragraph>
      </s-banner>

      {/* native div needed: s-box does not support the style prop */}
      <div
        style={{
          overflow: "auto",
          maxHeight: "360px",
          border: "1px solid var(--p-color-border)",
          borderRadius: "var(--p-border-radius-200)",
          padding: "var(--p-space-400)",
          background: "var(--p-color-bg-surface)",
        }}
      >
        <pre
          style={{
            margin: 0,
            fontFamily: "monospace",
            fontSize: "12px",
            lineHeight: "1.6",
            whiteSpace: "pre",
            color: "#657b83",
          }}
        >
          {snippet}
        </pre>
      </div>

      <s-button variant="secondary" onClick={onCopy}>
        Copy Liquid Snippet
      </s-button>
    </s-stack>
  );
}
