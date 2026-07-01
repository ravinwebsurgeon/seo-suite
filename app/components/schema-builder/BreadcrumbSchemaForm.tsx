import { useCallback } from "react";
import type { BreadcrumbSchemaData, BreadcrumbItem, ValidationError } from "../../types/schema-builder";
import { getFieldError } from "../../services/schema/form-validators";

interface BreadcrumbSchemaFormProps {
  data: BreadcrumbSchemaData;
  onChange: (data: BreadcrumbSchemaData) => void;
  errors: ValidationError[];
  storeUrl: string;
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function BreadcrumbSchemaForm({ data, onChange, errors, storeUrl }: BreadcrumbSchemaFormProps) {
  const addItem = useCallback(() => {
    onChange({ items: [...data.items, { id: generateId(), name: "", url: storeUrl }] });
  }, [data.items, onChange, storeUrl]);

  const removeItem = useCallback(
    (id: string) => { onChange({ items: data.items.filter((item) => item.id !== id) }); },
    [data.items, onChange],
  );

  const updateItem = useCallback(
    (id: string, field: keyof Omit<BreadcrumbItem, "id">, value: string) => {
      onChange({ items: data.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)) });
    },
    [data.items, onChange],
  );

  const moveItem = useCallback(
    (index: number, direction: "up" | "down") => {
      const next = [...data.items];
      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= next.length) return;
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
      onChange({ items: next });
    },
    [data.items, onChange],
  );

  const listError = getFieldError("items", errors);

  return (
    <s-stack direction="block" gap="base">
      <s-banner tone="info">
        <s-paragraph>
          Your store URL (<s-text type="strong">{storeUrl}</s-text>) is pre-filled as the base URL
          for each breadcrumb item.
        </s-paragraph>
      </s-banner>

      {listError && (
        <s-banner tone="critical">
          <s-paragraph>{listError}</s-paragraph>
        </s-banner>
      )}

      {data.items.map((item, index) => (
        <s-box key={item.id} padding="base" borderWidth="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="small">
            <s-stack direction="inline" alignItems="center" justifyContent="space-between">
              <s-text type="strong">Item {index + 1}</s-text>
              <s-stack direction="inline" gap="small-100">
                <s-button
                  variant="tertiary"
                  disabled={index === 0}
                  onClick={() => moveItem(index, "up")}
                  accessibilityLabel="Move up"
                >
                  ↑
                </s-button>
                <s-button
                  variant="tertiary"
                  disabled={index === data.items.length - 1}
                  onClick={() => moveItem(index, "down")}
                  accessibilityLabel="Move down"
                >
                  ↓
                </s-button>
                <s-button
                  variant="tertiary"
                  tone="critical"
                  onClick={() => removeItem(item.id)}
                  accessibilityLabel="Remove item"
                >
                  Remove
                </s-button>
              </s-stack>
            </s-stack>

            <s-text-field
              label="Label"
              value={item.name}
              error={getFieldError(`name_${index}`, errors)}
              details="Display text for this breadcrumb step"
              onInput={(e: Event) => updateItem(item.id, "name", (e.target as HTMLInputElement).value)}
            />

            <s-text-field
              label="URL"
              value={item.url}
              error={getFieldError(`url_${index}`, errors)}
              details="Full URL for this breadcrumb step"
              onInput={(e: Event) => updateItem(item.id, "url", (e.target as HTMLInputElement).value)}
            />
          </s-stack>
        </s-box>
      ))}

      <s-button onClick={addItem} variant="secondary">
        + Add Breadcrumb Item
      </s-button>
    </s-stack>
  );
}
