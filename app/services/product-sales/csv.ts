import type { BestSellerRow, ZeroSaleRow, HighDemandRow } from "../../types/product-sales";

// ─── CSV builders (pure, client + server safe) ─────────────────────────────────

function csvEscape(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
}

export function bestSellersToCsv(rows: BestSellerRow[]): string {
  return toCsv(
    ["Product", "Variant", "Revenue", "Units Sold", "Revenue %"],
    rows.map((r) => [
      r.productTitle,
      r.variantTitle,
      r.revenue.toFixed(2),
      String(r.unitsSold),
      r.revenuePercentage.toFixed(2) + "%",
    ]),
  );
}

export function zeroSalesToCsv(rows: ZeroSaleRow[]): string {
  return toCsv(
    ["Product", "Variant", "Inventory", "Last Sale Date", "Days Since Last Sale"],
    rows.map((r) => [
      r.productTitle,
      r.variantTitle,
      String(r.inventoryQuantity),
      r.lastSaleDate ?? "N/A",
      r.daysSinceLastSale !== null ? String(r.daysSinceLastSale) : "N/A",
    ]),
  );
}

export function highDemandToCsv(rows: HighDemandRow[]): string {
  return toCsv(
    ["Product", "Variant", "Inventory", "Units Sold (14d)", "Velocity Score", "Estimated Days Remaining"],
    rows.map((r) => [
      r.productTitle,
      r.variantTitle,
      String(r.inventoryQuantity),
      String(r.unitsSold14d),
      r.salesVelocity.toFixed(2),
      r.estimatedDaysRemaining !== null ? String(r.estimatedDaysRemaining) : "N/A",
    ]),
  );
}

// ─── Browser download helper ───────────────────────────────────────────────────

/**
 * Triggers a client-side CSV download. Works inside the embedded admin iframe
 * because the Blob URL is same-origin to the frame — no server round-trip and
 * no full-document navigation that would drop the embedded session.
 */
export function downloadCsv(filename: string, csv: string): void {
  // Prepend a UTF-8 BOM so Excel opens accented characters correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
