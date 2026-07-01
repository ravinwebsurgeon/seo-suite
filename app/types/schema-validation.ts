// ─── Schema Validation Engine — result contract ───────────────────────────────
//
// These types describe the structured output of the in-app Schema Validation
// Engine. They are intentionally independent of both the UI and the Shopify
// data layer so the engine stays modular, isomorphic (runs on client + server)
// and reusable across every schema type.

/** Severity buckets a check can fall into. */
export type IssueSeverity = "error" | "warning" | "suggestion" | "passed";

/** Overall health label derived from the numeric score. */
export type HealthStatus = "Excellent" | "Good" | "Needs Improvement" | "Failed";

/** A single validation finding (missing field, invalid value, or a passed check). */
export interface ValidationIssue {
  /** Dot-path of the JSON-LD field the finding relates to, e.g. `offers.price`. */
  field: string;
  /** Human-friendly field name, e.g. "Product Price". */
  label: string;
  /** What is wrong (or, for passed checks, what is correct). */
  message: string;
  /** Optional actionable hint on how to fix it. */
  recommendation?: string;
}

/** The full structured response returned by every validator. */
export interface SchemaValidationResult {
  /** Schema type that was validated, e.g. "Product". */
  schemaType: string;
  /** True when there are zero blocking errors → publishing is allowed. */
  valid: boolean;
  /** Health score, 0–100. */
  score: number;
  /** Badge label derived from `score`. */
  status: HealthStatus;
  /** Blocking issues that prevent publishing. */
  errors: ValidationIssue[];
  /** Non-blocking issues that reduce schema quality. */
  warnings: ValidationIssue[];
  /** SEO improvement opportunities. */
  suggestions: ValidationIssue[];
  /** Checks that passed successfully. */
  passed: ValidationIssue[];
}

/**
 * Optional extra context the engine cannot infer from the JSON-LD alone.
 * Supplied by callers that have access to the underlying Shopify data
 * (e.g. the `/api/schema/validate` endpoint) so the engine can run the
 * advanced, cross-field consistency checks.
 */
export interface ProductValidationContext {
  /** Tracked inventory quantity; `null` when inventory is not tracked. */
  inventory?: number | null;
  /** Compare-at ("was") price, if any. */
  compareAtPrice?: number | null;
}

export interface ValidationContextMap {
  product?: ProductValidationContext;
}
