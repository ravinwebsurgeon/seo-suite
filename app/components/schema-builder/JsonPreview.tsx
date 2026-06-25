interface JsonPreviewProps {
  schema: Record<string, unknown>;
  onCopy: () => void;
  onDownload: () => void;
  onValidate: () => void;
}

function syntaxHighlight(json: string): string {
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "color:#268bd2";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "color:#859900" : "color:#2aa198";
        } else if (/true|false/.test(match)) {
          cls = "color:#b58900";
        } else if (/null/.test(match)) {
          cls = "color:#dc322f";
        }
        return `<span style="${cls}">${match}</span>`;
      },
    );
}

export function JsonPreview({ schema, onCopy, onDownload, onValidate }: JsonPreviewProps) {
  const jsonString = JSON.stringify(schema, null, 2);
  const highlighted = syntaxHighlight(jsonString);

  return (
    <s-stack direction="block" gap="small">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text type="strong">JSON-LD Preview</s-text>
        <s-badge tone="success">Live</s-badge>
      </s-stack>

      {/* native div needed: s-box does not support the style prop */}
      <div
        style={{
          overflow: "auto",
          maxHeight: "420px",
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
          }}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </div>

      <s-stack direction="inline" gap="small">
        <s-button variant="primary" onClick={onCopy}>
          Copy JSON-LD
        </s-button>
        <s-button variant="secondary" onClick={onDownload}>
          Download
        </s-button>
        <s-button variant="secondary" onClick={onValidate}>
          Validate in Google
        </s-button>
      </s-stack>
    </s-stack>
  );
}
