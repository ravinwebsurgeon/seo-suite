import type { SchemaType } from "../../types/schema-builder";

interface SchemaOption {
  type: SchemaType;
  label: string;
  description: string;
  icon: string;
}

const OPTIONS: SchemaOption[] = [
  { type: "product", label: "Product", description: "Rich product listings with price & availability", icon: "product" },
  { type: "article", label: "Article", description: "Blog posts and news articles", icon: "blog" },
  { type: "breadcrumb", label: "Breadcrumb", description: "Site navigation path for search results", icon: "location" },
  { type: "faq", label: "FAQ", description: "Frequently asked questions markup", icon: "question-mark" },
];

interface SchemaTypeSelectorProps {
  selected: SchemaType;
  onChange: (type: SchemaType) => void;
}

export function SchemaTypeSelector({ selected, onChange }: SchemaTypeSelectorProps) {
  return (
    <s-grid gridTemplateColumns="repeat(2, 1fr)" gap="small">
      {OPTIONS.map((opt) => {
        const isSelected = selected === opt.type;
        return (
          <s-grid-item key={opt.type}>
            {/* native div for cursor + outline — s-box does not support the style prop */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onChange(opt.type)}
              onKeyDown={(e) => e.key === "Enter" && onChange(opt.type)}
              style={{
                cursor: "pointer",
                outline: isSelected ? "2px solid var(--p-color-border-interactive)" : "none",
                borderRadius: "var(--p-border-radius-200)",
              }}
            >
              <s-box
                padding="base"
                borderWidth="base"
                borderRadius="base"
                background={isSelected ? "subdued" : "base"}
              >
                <s-stack direction="block" gap="small-100">
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-icon type={opt.icon as never} />
                    <s-text type="strong">{opt.label}</s-text>
                    {isSelected && <s-badge tone="info">Selected</s-badge>}
                  </s-stack>
                  <s-text color="subdued">{opt.description}</s-text>
                </s-stack>
              </s-box>
            </div>
          </s-grid-item>
        );
      })}
    </s-grid>
  );
}
