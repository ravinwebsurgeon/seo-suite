import { useState, useCallback, useEffect } from "react";
import type { Collection, SortColumn, SortState } from "../../types/dead-collection-cleaner";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function sortCollections(collections: Collection[], sort: SortState): Collection[] {
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
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
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
            <s-option key={size} value={size.toString()}>
              {size}
            </s-option>
          ))}
        </s-select>
      </s-stack>

      <s-text tone="neutral">
        {totalItems === 0 ? "0 items" : `${start}–${end} of ${totalItems}`}
      </s-text>

      <s-stack direction="inline" gap="small-200">
        <s-button
          variant="secondary"
          disabled={currentPage === 1 || undefined}
          onClick={() => onPageChange(currentPage - 1)}
        >
          Previous
        </s-button>
        <s-button
          variant="secondary"
          disabled={currentPage === totalPages || undefined}
          onClick={() => onPageChange(currentPage + 1)}
        >
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

  // Reset to page 1 and clear selection when the dataset changes (e.g. after deletion)
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

  // Select-all only operates on the current page; selections on other pages are preserved
  const allOnPageSelected =
    paginated.length > 0 && paginated.every((c) => selectedIds.has(c.id));
  const someOnPageSelected =
    paginated.some((c) => selectedIds.has(c.id)) && !allOnPageSelected;

  const handleSelectAll = useCallback(
    (e: Event) => {
      const checked = (e.target as HTMLInputElement).checked;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const c of paginated) {
          if (checked) {
            next.add(c.id);
          } else {
            next.delete(c.id);
          }
        }
        return next;
      });
    },
    [paginated],
  );

  const handleSelectRow = useCallback(
    (id: string) => (e: Event) => {
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
    },
    [],
  );

  const handleDelete = () => {
    onDeleteSelected([...selectedIds]);
  };

  const handleExport = () => {
    // Export selected IDs, or all items when nothing is selected
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
          <s-stack
            direction="inline"
            gap="base"
            alignItems="center"
            justifyContent="space-between"
          >
            <s-text>
              {selectedIds.size} collection{selectedIds.size !== 1 ? "s" : ""} selected
            </s-text>
            <s-button-group>
              <s-button
                tone="critical"
                onClick={handleDelete}
                disabled={isDeleting || undefined}
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
            <SortButton
              column="type"
              label="Type / Status"
              currentSort={sort}
              onSort={handleSort}
            />
          </s-table-header>
          <s-table-header format="numeric">
            <SortButton
              column="productsCount"
              label="Products"
              currentSort={sort}
              onSort={handleSort}
            />
          </s-table-header>
          <s-table-header>
            <SortButton
              column="updatedAt"
              label="Last Updated"
              currentSort={sort}
              onSort={handleSort}
            />
          </s-table-header>
          <s-table-header>Actions</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {paginated.map((collection) => (
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
                  disabled={isDeleting || undefined}
                  {...(isDeleting ? { loading: true } : {})}
                >
                  Delete
                </s-button>
              </s-table-cell>
            </s-table-row>
          ))}
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
