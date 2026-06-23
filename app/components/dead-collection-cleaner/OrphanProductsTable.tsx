import { useState, useCallback, useEffect } from "react";
import type { OrphanProduct, Collection, ProductStatus } from "../../types/dead-collection-cleaner";

interface OrphanProductsTableProps {
  products: OrphanProduct[];
  collections: Collection[];
  onAssign: (productId: string, collectionId: string) => void;
  isAssigning: boolean;
}

function statusBadge(status: ProductStatus) {
  const toneMap: Record<ProductStatus, "success" | "neutral" | "warning"> = {
    ACTIVE: "success",
    DRAFT: "neutral",
    ARCHIVED: "warning",
  };
  const labelMap: Record<ProductStatus, string> = {
    ACTIVE: "Active",
    DRAFT: "Draft",
    ARCHIVED: "Archived",
  };
  return <s-badge tone={toneMap[status]}>{labelMap[status]}</s-badge>;
}

export function OrphanProductsTable({
  products,
  collections,
  onAssign,
  isAssigning,
}: OrphanProductsTableProps) {
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  // Reset saving state and clear assignment once the fetcher finishes
  useEffect(() => {
    if (!isAssigning && saving !== null) {
      setAssignments((prev) => {
        const next = { ...prev };
        delete next[saving];
        return next;
      });
      setSaving(null);
    }
  }, [isAssigning, saving]);

  const handleCollectionChange = useCallback(
    (productId: string) => (e: Event) => {
      const value = (e.target as HTMLSelectElement).value;
      setAssignments((prev) => ({ ...prev, [productId]: value }));
    },
    [],
  );

  const handleSave = useCallback(
    (productId: string) => () => {
      const collectionId = assignments[productId];
      if (!collectionId) return;
      setSaving(productId);
      onAssign(productId, collectionId);
    },
    [assignments, onAssign],
  );

  if (products.length === 0) {
    return (
      <s-banner tone="success" heading="No orphan products">
        All products belong to at least one collection.
      </s-banner>
    );
  }

  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Product Name</s-table-header>
        <s-table-header>Status</s-table-header>
        <s-table-header>Assign to Collection</s-table-header>
        <s-table-header>Action</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {products.map((product) => {
          const selectedCollection = assignments[product.id] ?? "";
          const isSaving = isAssigning && saving === product.id;

          return (
            <s-table-row key={product.id}>
              <s-table-cell>
                <s-text>{product.title}</s-text>
              </s-table-cell>
              <s-table-cell>{statusBadge(product.status)}</s-table-cell>
              <s-table-cell>
                <s-select
                  label="Select collection"
                  labelAccessibilityVisibility="exclusive"
                  value={selectedCollection}
                  onChange={handleCollectionChange(product.id)}
                >
                  <s-option value="">Choose a collection…</s-option>
                  {collections.map((c) => (
                    <s-option key={c.id} value={c.id}>
                      {c.title}
                    </s-option>
                  ))}
                </s-select>
              </s-table-cell>
              <s-table-cell>
                <s-button
                  onClick={handleSave(product.id)}
                  disabled={selectedCollection === "" || isSaving || undefined}
                  {...(isSaving ? { loading: true } : {})}
                >
                  {isSaving ? "Saving…" : "Save"}
                </s-button>
              </s-table-cell>
            </s-table-row>
          );
        })}
      </s-table-body>
    </s-table>
  );
}
