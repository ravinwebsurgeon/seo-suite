// ─── Shared validator utilities ───────────────────────────────────────────────
//
// Reference data + primitive checks + a scoring collector shared by every
// per-type validator. Everything here is pure and isomorphic (no server-only
// imports) so validators can run in the browser and on the server alike.

import type {
  HealthStatus,
  IssueSeverity,
  SchemaValidationResult,
  ValidationIssue,
} from "../../../types/schema-validation";

// ── Reference data ────────────────────────────────────────────────────────────

/** ISO 4217 currency codes (common set). */
export const ISO_4217_CURRENCIES = new Set([
  "AED", "AFN", "ALL", "AMD", "ANG", "AOA", "ARS", "AUD", "AWG", "AZN",
  "BAM", "BBD", "BDT", "BGN", "BHD", "BIF", "BMD", "BND", "BOB", "BRL",
  "BSD", "BTN", "BWP", "BYN", "BZD", "CAD", "CDF", "CHF", "CLP", "CNY",
  "COP", "CRC", "CUP", "CVE", "CZK", "DJF", "DKK", "DOP", "DZD", "EGP",
  "ERN", "ETB", "EUR", "FJD", "FKP", "GBP", "GEL", "GHS", "GIP", "GMD",
  "GNF", "GTQ", "GYD", "HKD", "HNL", "HRK", "HTG", "HUF", "IDR", "ILS",
  "INR", "IQD", "IRR", "ISK", "JMD", "JOD", "JPY", "KES", "KGS", "KHR",
  "KMF", "KPW", "KRW", "KWD", "KYD", "KZT", "LAK", "LBP", "LKR", "LRD",
  "LSL", "LYD", "MAD", "MDL", "MGA", "MKD", "MMK", "MNT", "MOP", "MRU",
  "MUR", "MVR", "MWK", "MXN", "MYR", "MZN", "NAD", "NGN", "NIO", "NOK",
  "NPR", "NZD", "OMR", "PAB", "PEN", "PGK", "PHP", "PKR", "PLN", "PYG",
  "QAR", "RON", "RSD", "RUB", "RWF", "SAR", "SBD", "SCR", "SDG", "SEK",
  "SGD", "SHP", "SLE", "SOS", "SRD", "SSP", "STN", "SVC", "SYP", "SZL",
  "THB", "TJS", "TMT", "TND", "TOP", "TRY", "TTD", "TWD", "TZS", "UAH",
  "UGX", "USD", "UYU", "UZS", "VED", "VES", "VND", "VUV", "WST", "XAF",
  "XCD", "XOF", "XPF", "YER", "ZAR", "ZMW", "ZWL",
]);

/** Valid schema.org `ItemAvailability` values (bare, without the URL prefix). */
export const SCHEMA_AVAILABILITY = new Set([
  "InStock", "OutOfStock", "PreOrder", "PreSale", "SoldOut", "BackOrder",
  "Discontinued", "InStoreOnly", "OnlineOnly", "LimitedAvailability",
  "MadeToOrder",
]);

/** Minimum description length before we suggest expanding it. */
export const MIN_DESCRIPTION_LENGTH = 50;

// ── Scoring weights (per spec) ────────────────────────────────────────────────

const ERROR_PENALTY = 20;
const WARNING_PENALTY = 5;
const SUGGESTION_PENALTY = 2;

// ── Primitive checks ──────────────────────────────────────────────────────────

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Validates an absolute http(s) URL. */
export function isValidUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.trim() === "") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isValidCurrency(value: unknown): boolean {
  return typeof value === "string" && ISO_4217_CURRENCIES.has(value.trim().toUpperCase());
}

/** Parses a price that may be a number or numeric string; NaN when unparseable. */
export function parsePrice(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

/** Normalises an availability value (bare or full schema.org URL) to its bare form. */
export function normalizeAvailability(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") return null;
  const bare = value.trim().replace(/^https?:\/\/schema\.org\//i, "");
  return bare;
}

export function isValidAvailability(value: unknown): boolean {
  const bare = normalizeAvailability(value);
  return bare !== null && SCHEMA_AVAILABILITY.has(bare);
}

/** Reads a nested object as a plain record, or null if it is not one. */
export function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

// ── Score → status mapping ────────────────────────────────────────────────────

export function statusFromScore(score: number): HealthStatus {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 50) return "Needs Improvement";
  return "Failed";
}

// ── Collector ─────────────────────────────────────────────────────────────────
//
// A small mutable accumulator each validator writes findings into, then calls
// `.finalize()` to compute the score, status and validity in one place.

export interface ValidationCollector {
  error(field: string, label: string, message: string, recommendation?: string): void;
  warn(field: string, label: string, message: string, recommendation?: string): void;
  suggest(field: string, label: string, message: string, recommendation?: string): void;
  pass(field: string, label: string, message: string): void;
  finalize(schemaType: string): SchemaValidationResult;
}

export function createCollector(): ValidationCollector {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const suggestions: ValidationIssue[] = [];
  const passed: ValidationIssue[] = [];

  const push = (
    bucket: ValidationIssue[],
    field: string,
    label: string,
    message: string,
    recommendation?: string,
  ) => {
    bucket.push({ field, label, message, ...(recommendation ? { recommendation } : {}) });
  };

  return {
    error: (field, label, message, recommendation) =>
      push(errors, field, label, message, recommendation),
    warn: (field, label, message, recommendation) =>
      push(warnings, field, label, message, recommendation),
    suggest: (field, label, message, recommendation) =>
      push(suggestions, field, label, message, recommendation),
    pass: (field, label, message) => push(passed, field, label, message),
    finalize(schemaType) {
      const raw =
        100 -
        errors.length * ERROR_PENALTY -
        warnings.length * WARNING_PENALTY -
        suggestions.length * SUGGESTION_PENALTY;
      const score = Math.max(0, Math.min(100, raw));
      return {
        schemaType,
        valid: errors.length === 0,
        score,
        status: statusFromScore(score),
        errors,
        warnings,
        suggestions,
        passed,
      };
    },
  };
}

/** Severity → tone helper used by the UI. */
export const SEVERITY_META: Record<
  IssueSeverity,
  { label: string; tone: "critical" | "warning" | "info" | "success"; icon: string }
> = {
  error: { label: "Errors", tone: "critical", icon: "alert-circle" },
  warning: { label: "Warnings", tone: "warning", icon: "alert-triangle" },
  suggestion: { label: "Suggestions", tone: "info", icon: "lightbulb" },
  passed: { label: "Passed Checks", tone: "success", icon: "check-circle" },
};
