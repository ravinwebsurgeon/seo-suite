import { diffWords } from "diff";

interface DiffViewProps {
  original: string | null;
  generated: string | null;
}

export function DiffView({ original, generated }: DiffViewProps) {
  if (!original && !generated) return null;
  if (!original) {
    return (
      <span style={{ color: "var(--p-color-text-success)", background: "var(--p-color-bg-success-subdued)", padding: "1px 2px", borderRadius: "2px" }}>
        {generated}
      </span>
    );
  }
  if (!generated) {
    return (
      <span style={{ color: "var(--p-color-text-critical)", textDecoration: "line-through" }}>
        {original}
      </span>
    );
  }
  if (original === generated) {
    return <span style={{ color: "var(--p-color-text-subdued)" }}>{generated}</span>;
  }

  const parts = diffWords(original, generated);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.added) {
          return (
            <span
              key={i}
              style={{
                color: "var(--p-color-text-success)",
                background: "var(--p-color-bg-success-subdued)",
                padding: "1px 2px",
                borderRadius: "2px",
              }}
            >
              {part.value}
            </span>
          );
        }
        if (part.removed) {
          return (
            <span
              key={i}
              style={{
                color: "var(--p-color-text-critical)",
                background: "var(--p-color-bg-critical-subdued)",
                textDecoration: "line-through",
                padding: "1px 2px",
                borderRadius: "2px",
              }}
            >
              {part.value}
            </span>
          );
        }
        return <span key={i}>{part.value}</span>;
      })}
    </span>
  );
}
