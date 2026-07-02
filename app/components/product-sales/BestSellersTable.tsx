import { useState } from "react";
import { useFetcher } from "react-router";
import type { BestSellerRow, BestSellerSortKey, SortDir } from "../../types/product-sales";
import { bestSellersToCsv, downloadCsv } from "../../services/product-sales/csv";

const PAGE_SIZE = 25;

function fmtCurrency(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

interface Props {
  rows: BestSellerRow[];
  dateRange: string;
  preset: string;
  cachedAt: string;
}

type ColumnDef = { key: BestSellerSortKey | null; label: string; align?: "right" };

const COLUMNS: ColumnDef[] = [
  { key: null, label: "#" },
  { key: null, label: "Product" },
  { key: "unitsSold", label: "Units Sold", align: "right" },
  { key: "revenue", label: "Revenue", align: "right" },
  { key: "revenuePercentage", label: "Rev %", align: "right" },
  { key: "inventoryQuantity", label: "Inventory", align: "right" },
];

export function BestSellersTable({ rows, dateRange, preset, cachedAt }: Props) {
  const fetcher = useFetcher();
  const [sortKey, setSortKey] = useState<BestSellerSortKey>("unitsSold");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const handleSort = (key: BestSellerSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
    setPage(0);
  };

  const filtered = rows.filter(
    (r) =>
      r.productTitle.toLowerCase().includes(search.toLowerCase()) ||
      r.variantTitle.toLowerCase().includes(search.toLowerCase()),
  );

  const sorted = [...filtered].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cachedLabel = new Date(cachedAt).toLocaleTimeString();

  return (
    <s-stack direction="block" gap="base">
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
            <input type="hidden" name="preset" value={preset} />
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
            onClick={() => downloadCsv(`best-sellers-${dateRange}.csv`, bestSellersToCsv(sorted))}
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
                {COLUMNS.map((col) => (
                  <th
                    key={col.label}
                    onClick={col.key ? () => handleSort(col.key!) : undefined}
                    style={{
                      padding: "10px 12px",
                      textAlign: col.align ?? "left",
                      fontWeight: 600,
                      cursor: col.key ? "pointer" : "default",
                      userSelect: "none",
                      whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--s-color-border, #e1e3e5)",
                    }}
                  >
                    {col.label}
                    {col.key === sortKey ? (sortDir === "desc" ? " ↓" : " ↑") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    style={{ padding: "24px", textAlign: "center", color: "#6d7175" }}
                  >
                    No products found.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const rank = page * PAGE_SIZE + i + 1;
                  return (
                    <tr
                      key={`${row.productId}__${row.variantId}`}
                      style={{ borderBottom: "1px solid var(--s-color-border, #e1e3e5)" }}
                    >
                      <td style={{ padding: "10px 12px", color: "#6d7175" }}>{rank}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <div>
                          <strong>{row.productTitle}</strong>
                          {row.variantTitle && (
                            <div style={{ fontSize: "12px", color: "#6d7175" }}>{row.variantTitle}</div>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <s-badge tone="success">{row.unitsSold.toLocaleString()}</s-badge>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {fmtCurrency(row.revenue)}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {row.revenuePercentage.toFixed(1)}%
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <s-badge
                          tone={
                            row.inventoryQuantity <= 5
                              ? "critical"
                              : row.inventoryQuantity <= 20
                              ? "warning"
                              : "neutral"
                          }
                        >
                          {row.inventoryQuantity.toLocaleString()}
                        </s-badge>
                      </td>
                    </tr>
                  );
                })
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
