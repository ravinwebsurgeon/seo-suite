import { useState } from "react";
import { useFetcher } from "react-router";
import type { ZeroSaleRow } from "../../types/product-sales";
import { zeroSalesToCsv, downloadCsv } from "../../services/product-sales/csv";

const PAGE_SIZE = 25;

interface Props {
  rows: ZeroSaleRow[];
  dateRange: string;
  cachedAt: string;
}

export function ZeroSalesTable({ rows, dateRange, cachedAt }: Props) {
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const filtered = rows.filter(
    (r) =>
      r.productTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.variantTitle.toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cachedLabel = new Date(cachedAt).toLocaleTimeString();

  function fmtDate(iso: string) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }

  return (
    <s-stack direction="block" gap="base">
      <s-banner tone="info" heading="Zero Sale Products">
        These products had no sales during the selected date range. Consider discounting, archiving, or adding to a clearance collection.
      </s-banner>

      {/* Toolbar */}
      <s-stack direction="inline" gap="small" alignItems="center">
        <s-text-field
          label=""
          placeholder="Search products…"
          value={search}
          onInput={(e: Event) => {
            setSearch((e.target as HTMLInputElement).value);
            setPage(0);
          }}
        />
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginLeft: "auto" }}>
          <s-text>Cached at {cachedLabel}</s-text>
          <fetcher.Form method="post">
            <input type="hidden" name="_intent" value="refresh" />
            <input type="hidden" name="dateRange" value={dateRange} />
            <s-button
              variant="secondary"
              type="submit"
              {...(fetcher.state !== "idle" ? { loading: true } : {})}
            >
              Refresh
            </s-button>
          </fetcher.Form>
          <s-button
            variant="secondary"
            onClick={() => downloadCsv(`zero-sales-${dateRange}.csv`, zeroSalesToCsv(filtered))}
          >
            Export CSV
          </s-button>
        </div>
      </s-stack>

      {/* Table */}
      <s-box borderWidth="base" borderRadius="base">
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
            <thead>
              <tr style={{ background: "var(--s-color-bg-surface-secondary, #f6f6f7)" }}>
                {["Product", "Inventory", "Created", "Last Sale", "Days w/o Sale"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--s-color-border, #e1e3e5)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    style={{ padding: "24px", textAlign: "center", color: "#6d7175" }}
                  >
                    {rows.length === 0
                      ? "Great news — all products had sales in this period!"
                      : "No products match your search."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr
                    key={`${row.productId}__${row.variantId}`}
                    style={{ borderBottom: "1px solid var(--s-color-border, #e1e3e5)" }}
                  >
                    <td style={{ padding: "10px 12px" }}>
                      <div>
                        <strong>{row.productTitle}</strong>
                        {row.variantTitle && (
                          <div style={{ fontSize: "12px", color: "#6d7175" }}>{row.variantTitle}</div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <s-badge tone={row.inventoryQuantity === 0 ? "neutral" : "warning"}>
                        {row.inventoryQuantity.toLocaleString()}
                      </s-badge>
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>
                      {fmtDate(row.createdAt)}
                    </td>
                    <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: "#6d7175" }}>
                      {row.lastSaleDate ? fmtDate(row.lastSaleDate) : "—"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {row.daysSinceLastSale !== null ? (
                        <s-badge tone={row.daysSinceLastSale > 60 ? "critical" : "warning"}>
                          {row.daysSinceLastSale}d
                        </s-badge>
                      ) : (
                        <span style={{ color: "#6d7175" }}>—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </s-box>

      {/* Pagination */}
      {totalPages > 1 && (
        <s-stack direction="inline" gap="small" alignItems="center" justifyContent="center">
          <s-button
            variant="secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            {...(page === 0 ? { disabled: true } : {})}
          >
            Previous
          </s-button>
          <s-text>
            Page {page + 1} of {totalPages} ({filtered.length.toLocaleString()} products)
          </s-text>
          <s-button
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            {...(page >= totalPages - 1 ? { disabled: true } : {})}
          >
            Next
          </s-button>
        </s-stack>
      )}
    </s-stack>
  );
}
