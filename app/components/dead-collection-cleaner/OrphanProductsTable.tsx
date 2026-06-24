import { useState, useRef, useCallback, useEffect } from "react";
import type { elements } from "@shopify/polaris-types";
import type { OrphanProduct, Collection, ProductStatus } from "../../types/dead-collection-cleaner";

type SelectInstance = InstanceType<typeof elements.Select>;
type ButtonInstance = InstanceType<typeof elements.Button>;

const PAGE_SIZE_OPTIONS = [10, 25, 50] as const;
type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

function statusBadge(status: ProductStatus) {
  const toneMap: Record<ProductStatus, "success" | "neutral" | "warning" | "info"> = {
    ACTIVE: "success",
    DRAFT: "neutral",
    ARCHIVED: "warning",
    UNLISTED: "info",
  };
  const labelMap: Record<ProductStatus, string> = {
    ACTIVE: "Active",
    DRAFT: "Draft",
    ARCHIVED: "Archived",
    UNLISTED: "Unlisted",
  };
  return <s-badge tone={toneMap[status]}>{labelMap[status]}</s-badge>;
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

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Read the current value from an s-select element using every available strategy. */
function readSelectValue(el: Element): string {
  // 1. Web component's own reflected value property (fastest path)
  const componentValue = (el as HTMLElement & { value?: string }).value;
  if (typeof componentValue === "string") return componentValue;

  // 2. Native <select> inside open shadow DOM (most reliable fallback)
  try {
    const nativeSelect = el.shadowRoot?.querySelector("select");
    if (nativeSelect) return nativeSelect.value;
  } catch {
    // shadow DOM is closed — skip
  }

  return "";
}

// ─── ProductRow ───────────────────────────────────────────────────────────────
// Each row owns its own select value and save-pending state.
//
// All interaction with s-select and s-button goes through native addEventListener
// and imperative DOM attribute/property writes because React's synthetic event
// delegation and prop updates are unreliable across the
// s-table-cell → s-table-row → s-table-body → s-table shadow-DOM slot chain.

interface ProductRowProps {
  product: OrphanProduct;
  collections: Collection[];
  onAssign: (productId: string, collectionId: string) => void;
  isAssigning: boolean;
}

function ProductRow({ product, collections, onAssign, isAssigning }: ProductRowProps) {
  const [selectedCollection, setSelectedCollection] = useState("");
  const [pendingSave, setPendingSave] = useState(false);

  const selectRef = useRef<SelectInstance>(null);
  const buttonRef = useRef<ButtonInstance>(null);

  const isSaving = pendingSave && isAssigning;

  // Stable refs so mount-only listeners always see current values without
  // needing to be re-attached on every render.
  const pendingRef = useRef(pendingSave);
  const onAssignRef = useRef(onAssign);
  useEffect(() => { pendingRef.current = pendingSave; });
  useEffect(() => { onAssignRef.current = onAssign; });

  // Once the server round-trip finishes (isAssigning → false), clear the
  // pending flag and reset the select back to the placeholder.
  useEffect(() => {
    if (!isAssigning && pendingSave) {
      setPendingSave(false);
      setSelectedCollection("");
    }
  }, [isAssigning, pendingSave]);

  // Sync the web component's displayed value with React state.
  // Needed so the select visually resets to "Choose a collection…" after a save.
  useEffect(() => {
    const el = selectRef.current as Element | null;
    if (!el) return;
    (el as HTMLElement & { value?: string }).value = selectedCollection;
  }, [selectedCollection]);

  // Imperatively manage disabled + loading on the s-button DOM element.
  // React prop updates are unreliable inside shadow-DOM slot chains, so we
  // write directly via setAttribute / removeAttribute and property assignment.
  useEffect(() => {
    const btn = buttonRef.current as (ButtonInstance & { loading?: boolean }) | null;
    if (!btn) return;
    if (!selectedCollection || isSaving) {
      btn.setAttribute("disabled", "");
    } else {
      btn.removeAttribute("disabled");
    }
    btn.loading = isSaving;
  }, [selectedCollection, isSaving]);

  // Mount-only: attach native change listeners to s-select.
  // Three layers of detection so that placeholder re-selection is always caught:
  //  1. composedPath() → finds the native <select> inside shadow DOM for the
  //     most accurate value, even when the web component re-dispatches the event.
  //  2. Web component value property fallback if composedPath has no native <select>.
  //  3. Direct listener on the native <select> inside open shadow DOM — this fires
  //     before the web component re-dispatches, giving an early, guaranteed read.
  useEffect(() => {
    const el = selectRef.current as Element | null;
    if (!el) return;

    const updateValue = (val: string) => setSelectedCollection(val);

    const onChangeEvent = (e: Event) => {
      // Prefer the native <select> value from the composed path
      const nativeSel = e.composedPath().find(
        (n): n is HTMLSelectElement => n instanceof HTMLSelectElement,
      );
      if (nativeSel) {
        updateValue(nativeSel.value);
        return;
      }
      // Fallback: web component's own value property
      updateValue(readSelectValue(el));
    };

    el.addEventListener("change", onChangeEvent);
    el.addEventListener("input", onChangeEvent);

    // Layer 3: direct listener on shadow-DOM native <select> (open shadow only)
    let nativeSelect: HTMLSelectElement | null = null;
    try {
      nativeSelect = el.shadowRoot?.querySelector("select") ?? null;
    } catch { /* closed shadow DOM */ }

    const onNativeChange = nativeSelect
      ? () => updateValue((nativeSelect as HTMLSelectElement).value)
      : null;

    if (nativeSelect && onNativeChange) {
      nativeSelect.addEventListener("change", onNativeChange);
    }

    return () => {
      el.removeEventListener("change", onChangeEvent);
      el.removeEventListener("input", onChangeEvent);
      if (nativeSelect && onNativeChange) {
        nativeSelect.removeEventListener("change", onNativeChange);
      }
    };
  }, []);

  // Mount-only: native click on the Save s-button.
  // Reads the collection ID DIRECTLY from the DOM element at click time —
  // this is the absolute guard against stale React state and is the reason
  // the form can never submit an empty collection ID from the frontend.
  useEffect(() => {
    const btn = buttonRef.current;
    if (!btn) return;
    const handler = () => {
      if (pendingRef.current) return;

      // Read authoritative value from DOM (not from React state)
      const el = selectRef.current as Element | null;
      const col = el ? readSelectValue(el) : "";

      if (!col) {
        // Value is empty — ensure button is visually disabled and bail
        (btn as HTMLElement).setAttribute("disabled", "");
        return;
      }

      // Sync React state in case it was stale (e.g. change event was missed)
      setSelectedCollection(col);
      setPendingSave(true);
      onAssignRef.current(product.id, col);
    };
    btn.addEventListener("click", handler);
    return () => btn.removeEventListener("click", handler);
  }, [product.id]);

  return (
    <s-table-row>
      <s-table-cell>
        <s-text>{product.title}</s-text>
      </s-table-cell>
      <s-table-cell>{statusBadge(product.status)}</s-table-cell>
      <s-table-cell>
        {/* Value and change events are managed imperatively via selectRef */}
        <s-select
          ref={selectRef}
          label="Select collection"
          labelAccessibilityVisibility="exclusive"
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
        {/* disabled, loading, and click are managed imperatively via buttonRef */}
        <s-button ref={buttonRef}>Save</s-button>
      </s-table-cell>
    </s-table-row>
  );
}

// ─── OrphanProductsTable ──────────────────────────────────────────────────────

interface OrphanProductsTableProps {
  products: OrphanProduct[];
  collections: Collection[];
  onAssign: (productId: string, collectionId: string) => void;
  isAssigning: boolean;
}

export function OrphanProductsTable({
  products,
  collections,
  onAssign,
  isAssigning,
}: OrphanProductsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<PageSize>(25);

  const totalPages = Math.max(1, Math.ceil(products.length / pageSize));
  const clampedPage = Math.min(currentPage, totalPages);
  const startIndex = (clampedPage - 1) * pageSize;
  const paginated = products.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [products.length]);

  const handlePageSizeChange = useCallback((size: PageSize) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  if (products.length === 0) {
    return (
      <s-banner tone="success" heading="No orphan products">
        All products belong to at least one collection.
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Product Name</s-table-header>
          <s-table-header>Status</s-table-header>
          <s-table-header>Assign to Collection</s-table-header>
          <s-table-header>Action</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {paginated.map((product) => (
            <ProductRow
              key={product.id}
              product={product}
              collections={collections}
              onAssign={onAssign}
              isAssigning={isAssigning}
            />
          ))}
        </s-table-body>
      </s-table>

      <PaginationControls
        currentPage={clampedPage}
        totalPages={totalPages}
        totalItems={products.length}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={handlePageSizeChange}
      />
    </s-stack>
  );
}
