import { forwardRef, useImperativeHandle, useRef } from "react";
import type { elements } from "@shopify/polaris-types";
import type {
  HealthStatus,
  SchemaValidationResult,
  ValidationIssue,
} from "../../types/schema-validation";

type ModalInstance = InstanceType<typeof elements.Modal>;

const MODAL_ID = "schema-validation-report-modal";

export interface ValidationReportHandle {
  open: () => void;
  close: () => void;
}

interface ValidationReportProps {
  result: SchemaValidationResult | null;
}

// ── Score → colour + status tone ────────────────────────────────────────────
const STATUS_TONE: Record<HealthStatus, "success" | "info" | "warning" | "critical"> = {
  Excellent: "success",
  Good: "info",
  "Needs Improvement": "warning",
  Failed: "critical",
};

function scoreColor(score: number): string {
  if (score >= 90) return "var(--p-color-text-success, #0a7c3e)";
  if (score >= 75) return "var(--p-color-text-info, #0a6ed1)";
  if (score >= 50) return "var(--p-color-text-warning, #b98900)";
  return "var(--p-color-text-critical, #d72c0d)";
}

// ── One section (Errors / Warnings / Suggestions / Passed) ───────────────────
function IssueSection({
  title,
  tone,
  issues,
  showRecommendation,
}: {
  title: string;
  tone: "critical" | "warning" | "info" | "success";
  issues: ValidationIssue[];
  showRecommendation: boolean;
}) {
  if (issues.length === 0) return null;
  return (
    <s-stack direction="block" gap="small-200">
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-badge tone={tone}>{`${title} (${issues.length})`}</s-badge>
      </s-stack>
      <s-stack direction="block" gap="small-300">
        {issues.map((issue) => (
          <s-box
            key={`${title}-${issue.field}-${issue.message}`}
            padding="small-200"
            borderRadius="base"
            background="subdued"
          >
            <s-stack direction="block" gap="none">
              <s-text type="strong">{issue.label}</s-text>
              <s-text>{issue.message}</s-text>
              {showRecommendation && issue.recommendation && (
                <s-text color="subdued">{`→ ${issue.recommendation}`}</s-text>
              )}
            </s-stack>
          </s-box>
        ))}
      </s-stack>
    </s-stack>
  );
}

export const ValidationReport = forwardRef<ValidationReportHandle, ValidationReportProps>(
  function ValidationReport({ result }, ref) {
    const modalRef = useRef<ModalInstance>(null);

    useImperativeHandle(ref, () => ({
      open: () => modalRef.current?.showOverlay(),
      close: () => modalRef.current?.hideOverlay(),
    }));

    return (
      <s-modal id={MODAL_ID} ref={modalRef} heading="Schema Validation Report" size="large">
        {!result ? (
          <s-paragraph>Run a validation to see the report.</s-paragraph>
        ) : (
          <s-stack direction="block" gap="base">
            {/* ── Overall status ── */}
            <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
              <s-stack direction="inline" gap="base" alignItems="center">
                <div
                  style={{
                    fontSize: "40px",
                    fontWeight: 700,
                    lineHeight: 1,
                    color: scoreColor(result.score),
                  }}
                >
                  {result.score}
                </div>
                <s-stack direction="block" gap="small-300">
                  <s-text color="subdued">Schema Health Score (0–100)</s-text>
                  <s-stack direction="inline" gap="small" alignItems="center">
                    <s-badge tone={STATUS_TONE[result.status]}>{result.status}</s-badge>
                    <s-badge tone={result.valid ? "success" : "critical"}>
                      {result.valid ? "Ready to publish" : "Blocked"}
                    </s-badge>
                  </s-stack>
                </s-stack>
              </s-stack>
            </s-box>

            {!result.valid && (
              <s-banner tone="critical">
                Fix the errors below before publishing this schema.
              </s-banner>
            )}
            {result.valid && result.errors.length === 0 && (
              <s-banner tone="success">
                No blocking errors — this schema is ready to publish.
              </s-banner>
            )}

            <IssueSection title="Errors" tone="critical" issues={result.errors} showRecommendation />
            <IssueSection title="Warnings" tone="warning" issues={result.warnings} showRecommendation />
            <IssueSection title="Suggestions" tone="info" issues={result.suggestions} showRecommendation />
            <IssueSection title="Passed Checks" tone="success" issues={result.passed} showRecommendation={false} />
          </s-stack>
        )}

        <s-button slot="primary-action" variant="primary" commandFor={MODAL_ID} command="--hide">
          Close
        </s-button>
      </s-modal>
    );
  },
);
