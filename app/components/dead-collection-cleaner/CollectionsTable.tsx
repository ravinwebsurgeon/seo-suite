import { useState, useCallback } from "react";
import type { Collection, SortColumn, SortState } from "../../types/dead-collection-cleaner";

interface CollectionsTableProps {
  collections: Collection[];
  onDeleteSelected: (ids: string[]) => void;
  onExportCsv: (ids: string[]) => void;
  isDeleting: boolean;
}

function sortCollections(
  collections: Collection[],
  sort: SortState,
): Collection[] {
  return [...collections].sort((a, b) => {
    let cmp = 0;
    switch (sort.column) {
      case "title":
        cmp = a.title.localeCompare(b.title);
        break;
      case "type":
        cmp = a.type.localeCompare(b.type);
        break;
      case "productsCount":
        cmp = a.productsCount - b.productsCount;
        break;
      case "updatedAt":
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
        break;
    }
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface SortButtonProps {
  column: SortColumn;
  label: string;
  currentSort: SortState;
  onSort: (column: SortColumn) => void;
}

function SortButton({ column, label, currentSort, onSort }: SortButtonProps) {
  const isActive = currentSort.column === column;
  const icon = isActive
    ? currentSort.direction === "asc"
      ? "sort-ascending"
      : "sort-descending"
    : "sort";

  return (
    <s-button
      variant="tertiary"
      onClick={() => onSort(column)}
    >
      <s-stack direction="inline" gap="small-100" alignItems="center">
        <s-text>{label}</s-text>
        <s-icon type={icon} />
      </s-stack>
    </s-button>
  );
}

export function CollectionsTable({
  collections,
  onDeleteSelected,
  onExportCsv,
  isDeleting,
}: CollectionsTableProps) {
  const [sort, setSort] = useState<SortState>({ column: "title", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const sorted = sortCollections(collections, sort);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }, []);

  const allSelected = sorted.length > 0 && selectedIds.size === sorted.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const handleSelectAll = useCallback(
    (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setSelectedIds(checked ? new Set(sorted.map((c) => c.id)) : new Set());
    },
    [sorted],
  );

  const handleSelectRow = useCallback((id: string) => (e: Event) => {
    const checked = (e.target as HTMLInputElement).checked;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }, []);

  const handleDelete = () => {
    onDeleteSelected([...selectedIds]);
  };

  const handleExport = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : sorted.map((c) => c.id);
    onExportCsv(ids);
  };

  const collectionTypeBadge = (c: Collection) => {
    if (c.isBroken) {
      return <s-badge tone="critical">Broken Automated</s-badge>;
    }
    if (c.isEmpty) {
      return <s-badge tone="warning">Empty</s-badge>;
    }
    if (c.type === "automated") {
      return <s-badge tone="neutral">Automated</s-badge>;
    }
    return <s-badge tone="neutral">Manual</s-badge>;
  };

  if (collections.length === 0) {
    return (
      <s-banner tone="success" heading="No issues found">
        All collections have products and are configured correctly.
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      {selectedIds.size > 0 && (
        <s-box
          padding="base"
          borderWidth="base"
          borderRadius="base"
          background="subdued"
        >
          <s-stack direction="inline" gap="base" alignItems="center" justifyContent="space-between">
            <s-text>
              {selectedIds.size} collection{selectedIds.size !== 1 ? "s" : ""} selected
            </s-text>
            <s-button-group>
              <s-button
                tone="critical"
                onClick={handleDelete}
                {...(isDeleting ? { loading: true } : {})}
              >
                Delete selected
              </s-button>
              <s-button variant="secondary" onClick={handleExport}>
                Export CSV
              </s-button>
            </s-button-group>
          </s-stack>
        </s-box>
      )}

      {selectedIds.size === 0 && (
        <s-stack direction="inline" justifyContent="end">
          <s-button variant="secondary" onClick={handleExport}>
            Export all as CSV
          </s-button>
        </s-stack>
      )}

      <s-table>
        <s-table-header-row>
          <s-table-header>
            <s-checkbox
              label="Select all"
              labelAccessibilityVisibility="exclusive"
              checked={allSelected}
              indeterminate={someSelected}
              onChange={handleSelectAll}
            />
          </s-table-header>
          <s-table-header listSlot="primary">
            <SortButton column="title" label="Collection" currentSort={sort} onSort={handleSort} />
          </s-table-header>
          <s-table-header>
            <SortButton column="type" label="Type / Status" currentSort={sort} onSort={handleSort} />
          </s-table-header>
          <s-table-header format="numeric">
            <SortButton column="productsCount" label="Products" currentSort={sort} onSort={handleSort} />
          </s-table-header>
          <s-table-header>
            <SortButton column="updatedAt" label="Last Updated" currentSort={sort} onSort={handleSort} />
          </s-table-header>
          <s-table-header>Actions</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {sorted.map((collection) => (
            <s-table-row key={collection.id}>
              <s-table-cell>
                <s-checkbox
                  label={`Select ${collection.title}`}
                  labelAccessibilityVisibility="exclusive"
                  checked={selectedIds.has(collection.id)}
                  onChange={handleSelectRow(collection.id)}
                />
              </s-table-cell>
              <s-table-cell>
                <s-text>{collection.title}</s-text>
              </s-table-cell>
              <s-table-cell>
                {collectionTypeBadge(collection)}
              </s-table-cell>
              <s-table-cell>
                <s-text>{collection.productsCount.toString()}</s-text>
              </s-table-cell>
              <s-table-cell>
                <s-text>{formatDate(collection.updatedAt)}</s-text>
              </s-table-cell>
              <s-table-cell>
                <s-button
                  variant="tertiary"
                  tone="critical"
                  onClick={() => onDeleteSelected([collection.id])}
                >
                  Delete
                </s-button>
              </s-table-cell>
            </s-table-row>
          ))}
        </s-table-body>
      </s-table>
    </s-stack>
  );
}
