import { useState, useCallback, useEffect } from "react";
import type { Collection, SortColumn, SortState } from "../../types/dead-collection-cleaner";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function sortCollections(collections: Collection[], sort: SortState): Collection[] {
  return [...collections].sort((a, b) => {
    let cmp = 0;
    switch (sort.column) {
      case "title": cmp = a.title.localeCompare(b.title); break;
      case "type": cmp = a.type.localeCompare(b.type); break;
      case "productsCount": cmp = a.productsCount - b.productsCount; break;
      case "updatedAt": cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(); break;
    }
    return sort.direction === "asc" ? cmp : -cmp;
  });
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
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
    ? currentSort.direction === "asc" ? "sort-ascending" : "sort-descending"
    : "sort";
  return (
    <s-button variant="tertiary" onClick={() => onSort(column)}>
      <s-stack direction="inline" gap="small-100" alignItems="center">
        <s-text>{label}</s-text>
        <s-icon type={icon} />
      </s-stack>
    </s-button>
  );
}

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: PageSize;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSize) => void;
}

function PaginationControls({
  currentPage, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange,
}: PaginationControlsProps) {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  return (
    <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="base">
      <s-stack direction="inline" gap="small-200" alignItems="center">
        <s-text>Show:</s-text>
        <s-select
          label="Items per page"
          labelAccessibilityVisibility="exclusive"
          value={pageSize.toString()}
          onChange={(e: Event) =>
            onPageSizeChange(Number((e.target as HTMLSelectElement).value) as PageSize)
          }
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <s-option key={size} value={size.toString()}>{size}</s-option>
          ))}
        </s-select>
      </s-stack>
      <s-text tone="neutral">
        {totalItems === 0 ? "0 items" : `${start}–${end} of ${totalItems}`}
      </s-text>
      <s-stack direction="inline" gap="small-200">
        <s-button variant="secondary" disabled={currentPage === 1 || undefined} onClick={() => onPageChange(currentPage - 1)}>
          Previous
        </s-button>
        <s-button variant="secondary" disabled={currentPage === totalPages || undefined} onClick={() => onPageChange(currentPage + 1)}>
          Next
        </s-button>
      </s-stack>
    </s-stack>
  );
}

interface CollectionsTableProps {
  collections: Collection[];
  onDeleteSelected: (ids: string[]) => void;
  onExportCsv: (ids: string[]) => void;
  isDeleting: boolean;
}

export function CollectionsTable({
  collections,
  onDeleteSelected,
  onExportCsv,
  isDeleting,
}: CollectionsTableProps) {
  const [sort, setSort] = useState<SortState>({ column: "title", direction: "asc" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  const sorted = sortCollections(collections, sort);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const paginated = sorted.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [collections.length]);

  const handleSort = useCallback((column: SortColumn) => {
    setSort((prev) => ({
      column,
      direction: prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
    setCurrentPage(1);
  }, []);

  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const allOnPageSelected = paginated.length > 0 && paginated.every((c) => selectedIds.has(c.id));
  const someOnPageSelected = paginated.some((c) => selectedIds.has(c.id)) && !allOnPageSelected;

  // Mirror MetaTable exactly: onClick, toggle from current React state, never read e.target
  const handleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allSelected = paginated.length > 0 && paginated.every((c) => prev.has(c.id));
      if (allSelected) {
        const next = new Set(prev);
        for (const c of paginated) next.delete(c.id);
        return next;
      }
      const next = new Set(prev);
      for (const c of paginated) next.add(c.id);
      return next;
    });
  }, [paginated]);

  const handleSelectOne = useCallback((id: string, currentlySelected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      currentlySelected ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const handleExport = () => {
    const ids = selectedIds.size > 0 ? [...selectedIds] : sorted.map((c) => c.id);
    onExportCsv(ids);
  };

  const collectionTypeBadge = (c: Collection) => {
    if (c.isBroken) return <s-badge tone="critical">Broken Automated</s-badge>;
    if (c.isEmpty) return <s-badge tone="warning">Empty</s-badge>;
    if (c.type === "automated") return <s-badge tone="neutral">Automated</s-badge>;
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
      {/* Bulk action bar — mirrors MetaTable's raw flex div approach */}
      {selectedIds.size > 0 && (
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">
              {selectedIds.size} collection{selectedIds.size !== 1 ? "s" : ""} selected
            </s-text>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
              <s-button
                tone="critical"
                onClick={() => onDeleteSelected([...selectedIds])}
                disabled={isDeleting || undefined}
                {...(isDeleting ? { loading: true } : {})}
              >
                Delete selected
              </s-button>
              <s-button variant="secondary" onClick={handleExport}>
                Export CSV
              </s-button>
            </div>
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
            {/* onChange with no event arg — mirrors MetaTable's handleSelectAll */}
            <s-checkbox
              label="Select all on page"
              labelAccessibilityVisibility="exclusive"
              checked={allOnPageSelected}
              indeterminate={someOnPageSelected}
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
          {paginated.map((collection) => {
            const isSelected = selectedIds.has(collection.id);
            return (
              <s-table-row key={collection.id}>
                <s-table-cell>
                  {/* onClick + !isSelected mirrors MetaRow's onChange={() => onSelect(id, !selected)) */}
                  <s-checkbox
                    label={`Select ${collection.title}`}
                    labelAccessibilityVisibility="exclusive"
                    checked={isSelected}
                    onChange={() => handleSelectOne(collection.id, isSelected)}
                  />
                </s-table-cell>
                <s-table-cell>
                  <s-text>{collection.title}</s-text>
                </s-table-cell>
                <s-table-cell>{collectionTypeBadge(collection)}</s-table-cell>
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
                    disabled={isDeleting || selectedIds.size > 0 || undefined}
                    {...(isDeleting ? { loading: true } : {})}
                  >
                    Delete
                  </s-button>
                </s-table-cell>
              </s-table-row>
            );
          })}
        </s-table-body>
      </s-table>

      <PaginationControls
        currentPage={clampedPage}
        totalPages={totalPages}
        totalItems={sorted.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </s-stack>
  );
}
