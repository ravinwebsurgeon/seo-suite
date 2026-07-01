// ─── Schema Validation Engine — registry & dispatcher ─────────────────────────
//
// A single entry point that routes a generated JSON-LD object to the correct
// per-type validator. New schema types (Organization, Recipe, Video, …) plug in
// here by adding one line to the registry — nothing else changes.

import type { SchemaType } from "../../../types/schema-builder";
import type {
  SchemaValidationResult,
  ValidationContextMap,
} from "../../../types/schema-validation";

import { validateProductSchema } from "./productValidator";
import { validateArticleSchema } from "./articleValidator";
import { validateFAQSchema } from "./faqValidator";
import { validateBreadcrumbSchema } from "./breadcrumbValidator";

export type SchemaValidator = (
  schema: Record<string, unknown>,
  context?: ValidationContextMap,
) => SchemaValidationResult;

/** Registry keyed by the app's SchemaType. */
export const VALIDATORS: Record<SchemaType, SchemaValidator> = {
  product: (schema, ctx) => validateProductSchema(schema, ctx?.product ?? {}),
  article: (schema) => validateArticleSchema(schema),
  faq: (schema) => validateFAQSchema(schema),
  breadcrumb: (schema) => validateBreadcrumbSchema(schema),
};

/**
 * Validate a generated JSON-LD schema of the given app `SchemaType`.
 * Returns a structured, UI-agnostic {@link SchemaValidationResult}.
 */
export function validateSchema(
  type: SchemaType,
  schema: Record<string, unknown>,
  context?: ValidationContextMap,
): SchemaValidationResult {
  const validator = VALIDATORS[type];
  if (!validator) {
    return {
      schemaType: type,
      valid: false,
      score: 0,
      status: "Failed",
      errors: [
        { field: "@type", label: "Schema Type", message: `Unsupported schema type: ${type}` },
      ],
      warnings: [],
      suggestions: [],
      passed: [],
    };
  }
  return validator(schema, context);
}

export { statusFromScore } from "./shared";
export type { SchemaValidationResult } from "../../../types/schema-validation";
