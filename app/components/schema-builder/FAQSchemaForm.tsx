import { useCallback } from "react";
import type { FAQSchemaData, FAQItem, ValidationError } from "../../types/schema-builder";
import { getFieldError } from "../../services/schema/validators";

interface FAQSchemaFormProps {
  data: FAQSchemaData;
  onChange: (data: FAQSchemaData) => void;
  errors: ValidationError[];
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function FAQSchemaForm({ data, onChange, errors }: FAQSchemaFormProps) {
  const addItem = useCallback(() => {
    onChange({ items: [...data.items, { id: generateId(), question: "", answer: "" }] });
  }, [data.items, onChange]);

  const removeItem = useCallback(
    (id: string) => { onChange({ items: data.items.filter((item) => item.id !== id) }); },
    [data.items, onChange],
  );

  const updateItem = useCallback(
    (id: string, field: keyof Omit<FAQItem, "id">, value: string) => {
      onChange({ items: data.items.map((item) => (item.id === id ? { ...item, [field]: value } : item)) });
    },
    [data.items, onChange],
  );

  const listError = getFieldError("items", errors);

  return (
    <s-stack direction="block" gap="base">
      {listError && (
        <s-banner tone="critical">
          <s-paragraph>{listError}</s-paragraph>
        </s-banner>
      )}

      {data.items.map((item, index) => (
        <s-box key={item.id} padding="base" borderWidth="base" borderRadius="base" background="base">
          <s-stack direction="block" gap="small">
            <s-stack direction="inline" alignItems="center" justifyContent="space-between">
              <s-text type="strong">FAQ {index + 1}</s-text>
              <s-button
                variant="tertiary"
                tone="critical"
                onClick={() => removeItem(item.id)}
                accessibilityLabel={`Remove FAQ ${index + 1}`}
              >
                Remove
              </s-button>
            </s-stack>

            <s-text-field
              label="Question"
              value={item.question}
              error={getFieldError(`question_${index}`, errors)}
              required
              details="The question users commonly ask"
              onInput={(e: Event) => updateItem(item.id, "question", (e.target as HTMLInputElement).value)}
            />

            <s-text-area
              label="Answer"
              value={item.answer}
              error={getFieldError(`answer_${index}`, errors)}
              required
              details="The answer to the question above"
              rows={3}
              onInput={(e: Event) => updateItem(item.id, "answer", (e.target as HTMLInputElement).value)}
            />
          </s-stack>
        </s-box>
      ))}

      <s-button onClick={addItem} variant="secondary">
        + Add FAQ Pair
      </s-button>
    </s-stack>
  );
}
