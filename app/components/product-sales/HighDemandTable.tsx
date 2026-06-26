import { useState } from "react";
import { useFetcher } from "react-router";
import type { HighDemandRow, HighDemandSortKey, SortDir } from "../../types/product-sales";

const PAGE_SIZE = 25;

interface Props {
  rows: HighDemandRow[];
  cachedAt: string;
}

type ColumnDef = { key: HighDemandSortKey | null; label: string; align?: "right" };

const COLUMNS: ColumnDef[] = [
  { key: null, label: "Product" },
  { key: "inventoryQuantity", label: "Inventory", align: "right" },
  { key: "unitsSold14d", label: "Units Sold (14d)", align: "right" },
  { key: "salesVelocity", label: "Velocity", align: "right" },
  { key: "estimatedDaysRemaining", label: "Est. Days Left", align: "right" },
];

function urgencyTone(days: number | null): "critical" | "warning" | "success" {
  if (days === null || days <= 7) return "critical";
  if (days <= 21) return "warning";
  return "success";
}

export function HighDemandTable({ rows, cachedAt }: Props) {
  const fetcher = useFetcher();
  const [sortKey, setSortKey] = useState<HighDemandSortKey>("salesVelocity");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const handleSort = (key: HighDemandSortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "estimatedDaysRemaining" ? "asc" : "desc");
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
    const av = a[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity);
    const bv = b[sortKey] ?? (sortDir === "asc" ? Infinity : -Infinity);
    return (Number(av) - Number(bv)) * mul;
  });

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const cachedLabel = new Date(cachedAt).toLocaleTimeString();

  return (
    <s-stack direction="block" gap="base">
      <s-banner tone="warning" heading="High Demand / Low Stock Alert">
        Products below are at risk of selling out. Velocity = units sold (last 14 days) ÷ inventory. Products with velocity &gt; 0.5 are flagged.
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
          <s-text>Cached at {cachedLabel} · Always last 14 days</s-text>
          <fetcher.Form method="post">
            <input type="hidden" name="_intent" value="refresh" />
            <s-button
              variant="secondary"
              type="submit"
              {...(fetcher.state !== "idle" ? { loading: true } : {})}
            >
              Refresh
            </s-button>
          </fetcher.Form>
          <fetcher.Form method="post">
            <input type="hidden" name="_intent" value="export_csv" />
            <s-button variant="secondary" type="submit">Export CSV</s-button>
          </fetcher.Form>
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
                    {rows.length === 0
                      ? "No products are currently at risk of stock-out."
                      : "No products match your search."}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const tone = urgencyTone(row.estimatedDaysRemaining);
                  return (
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
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <s-badge tone={row.inventoryQuantity <= 10 ? "critical" : "warning"}>
                          {row.inventoryQuantity.toLocaleString()}
                        </s-badge>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {row.unitsSold14d.toLocaleString()}
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <s-badge tone="critical">{row.salesVelocity.toFixed(2)}</s-badge>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        <s-badge tone={tone}>
                          {row.estimatedDaysRemaining !== null
                            ? `${row.estimatedDaysRemaining}d`
                            : "< 1d"}
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
