import { useState, useCallback, useEffect } from "react";
import type { FetcherWithComponents } from "react-router";
import type { MetaRecord, PageInfo, ResourceFilter, Tone } from "../../types/meta-generator";
import { DiffView } from "./DiffView";

type ValidTone = "auto" | "critical" | "neutral" | "info" | "success" | "caution" | "warning";

// ─── Character counter ────────────────────────────────────────────────────────

function CharCount({ value, max }: { value: string; max: number }) {
  const len = value.length;
  const tone: ValidTone = len > max ? "critical" : len > max * 0.9 ? "warning" : "neutral";
  return (
    <s-text tone={tone}>
      {len} / {max}
    </s-text>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { tone: ValidTone; label: string }> = {
  pending:   { tone: "neutral",  label: "Pending" },
  generated: { tone: "info",     label: "Generated" },
  approved:  { tone: "success",  label: "Approved" },
  rejected:  { tone: "warning",  label: "Rejected" },
  published: { tone: "success",  label: "Published" },
  failed:    { tone: "critical", label: "Failed" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { tone: "neutral" as ValidTone, label: status };
  return <s-badge tone={cfg.tone}>{cfg.label}</s-badge>;
}

// ─── Single row ───────────────────────────────────────────────────────────────

interface RowProps {
  record: MetaRecord;
  selected: boolean;
  tone: Tone;
  onSelect: (id: string, checked: boolean) => void;
  fetcher: FetcherWithComponents<unknown>;
}

function MetaRow({ record, selected, tone, onSelect, fetcher }: RowProps) {
  const [editTitle, setEditTitle] = useState(record.generatedTitle ?? "");
  const [editDesc, setEditDesc] = useState(record.generatedDescription ?? "");
  const [editKeyword, setEditKeyword] = useState(record.keyword ?? "");
  const [showDiff, setShowDiff] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setEditTitle(record.generatedTitle ?? "");
    setEditDesc(record.generatedDescription ?? "");
    setIsDirty(false);
  }, [record.generatedTitle, record.generatedDescription]);

  const submit = useCallback(
    (intent: string, extra?: Record<string, string>) => {
      const fd = new FormData();
      fd.set("_intent", intent);
      fd.set("resourceId", record.resourceId);
      fd.set("resourceType", record.resourceType);
      fd.set("tone", tone);
      fd.set("title", record.title);
      fd.set("contentHtml", "");
      fd.set("keyword", editKeyword);
      if (extra) Object.entries(extra).forEach(([k, v]) => fd.set(k, v));
      fetcher.submit(fd, { method: "POST" });
    },
    [record, tone, editKeyword, fetcher],
  );

  const saveEdits = useCallback(() => {
    const fd = new FormData();
    fd.set("_intent", "save_meta");
    fd.set("resourceId", record.resourceId);
    fd.set("resourceType", record.resourceType);
    fd.set("generatedTitle", editTitle);
    fd.set("generatedDescription", editDesc);
    fetcher.submit(fd, { method: "POST" });
    setIsDirty(false);
  }, [record, editTitle, editDesc, fetcher]);

  const saveKeyword = useCallback(() => {
    const fd = new FormData();
    fd.set("_intent", "save_keyword");
    fd.set("resourceId", record.resourceId);
    fd.set("resourceType", record.resourceType);
    fd.set("keyword", editKeyword);
    fetcher.submit(fd, { method: "POST" });
  }, [record, editKeyword, fetcher]);

  const isActionInFlight = (intent: string) =>
    fetcher.state !== "idle" &&
    fetcher.formData?.get("resourceId") === record.resourceId &&
    fetcher.formData?.get("_intent") === intent;

  const isGenerating = isActionInFlight("generate") || isActionInFlight("regenerate");
  const isApproving = isActionInFlight("approve");
  const isRejecting = isActionInFlight("reject");
  const isPublishing = isActionInFlight("publish");
  const isSavingKeyword = isActionInFlight("save_keyword");
  const isSavingEdits = isActionInFlight("save_meta");

  const canPublish =
    record.status === "approved" &&
    editTitle.length > 0 &&
    editTitle.length <= 60 &&
    editDesc.length > 0 &&
    editDesc.length <= 160;

  return (
    <s-table-row key={record.resourceId}>
      {/* Select */}
      <s-table-cell>
        <s-checkbox
          label={`Select ${record.title}`}
          labelAccessibilityVisibility="exclusive"
          checked={selected}
          onChange={() => onSelect(record.resourceId, !selected)}
        />
      </s-table-cell>

      {/* Type */}
      <s-table-cell>
        <s-badge tone={record.resourceType === "product" ? "info" : "neutral"}>
          {record.resourceType === "product" ? "Product" : "Article"}
        </s-badge>
      </s-table-cell>

      {/* Title / Handle */}
      <s-table-cell>
        <s-stack direction="block" gap="small-100">
          <s-text>{record.title}</s-text>
          <s-text tone="neutral">{record.handle}</s-text>
        </s-stack>
      </s-table-cell>

      {/* Current SEO */}
      <s-table-cell>
        <s-stack direction="block" gap="small-100">
          <s-text tone={record.currentSeoTitle ? "auto" : "critical"}>
            {record.currentSeoTitle ?? "—"}
          </s-text>
          <s-text tone={record.currentSeoDescription ? "neutral" : "critical"}>
            {record.currentSeoDescription
              ? record.currentSeoDescription.length > 60
                ? record.currentSeoDescription.slice(0, 60) + "…"
                : record.currentSeoDescription
              : "—"}
          </s-text>
        </s-stack>
      </s-table-cell>

      {/* Keyword */}
      <s-table-cell>
        <s-stack direction="inline" gap="small-100" alignItems="center">
          <s-text-field
            label="Keyword"
            labelAccessibilityVisibility="exclusive"
            value={editKeyword}
            onInput={(e: Event) =>
              setEditKeyword((e.target as HTMLInputElement).value)
            }
            placeholder="target keyword"
          />
          <s-button
            variant="tertiary"
            onClick={saveKeyword}
            {...(isSavingKeyword ? { loading: true } : {})}
            disabled={(isSavingKeyword || !editKeyword.trim()) || undefined}
          >
            Save
          </s-button>
        </s-stack>
      </s-table-cell>

      {/* Generated metadata — inline editing */}
      <s-table-cell>
        <s-stack direction="block" gap="small-100">
          {/* Title */}
          <s-stack direction="block" gap="small-100">
            <s-text-field
              label="SEO title"
              labelAccessibilityVisibility="exclusive"
              value={editTitle}
              onInput={(e: Event) => {
                setEditTitle((e.target as HTMLInputElement).value);
                setIsDirty(true);
              }}
              placeholder="Generated SEO title"
            />
            <CharCount value={editTitle} max={60} />
          </s-stack>

          {/* Description */}
          <s-stack direction="block" gap="small-100">
            <s-text-area
              label="Meta description"
              labelAccessibilityVisibility="exclusive"
              value={editDesc}
              onInput={(e: Event) => {
                setEditDesc((e.target as HTMLTextAreaElement).value);
                setIsDirty(true);
              }}
              placeholder="Generated meta description"
              rows={3}
            />
            <CharCount value={editDesc} max={160} />
          </s-stack>

          {/* Diff toggle */}
          {(record.currentSeoTitle || record.currentSeoDescription) &&
            editTitle && (
              <s-button
                variant="tertiary"
                onClick={() => setShowDiff((p) => !p)}
              >
                {showDiff ? "Hide diff" : "Show diff"}
              </s-button>
            )}

          {showDiff && (
            <s-stack direction="block" gap="small-100">
              <s-text>Title diff:</s-text>
              <s-box padding="small" background="subdued" borderRadius="base">
                <DiffView
                  original={record.currentSeoTitle}
                  generated={editTitle}
                />
              </s-box>
              <s-text>Description diff:</s-text>
              <s-box padding="small" background="subdued" borderRadius="base">
                <DiffView
                  original={record.currentSeoDescription}
                  generated={editDesc}
                />
              </s-box>
            </s-stack>
          )}

          {isDirty && (
            <s-button
              variant="secondary"
              onClick={saveEdits}
              {...(isSavingEdits ? { loading: true } : {})}
              disabled={
                (editTitle.length > 60 || editDesc.length > 160 || isSavingEdits) || undefined
              }
            >
              Save edits
            </s-button>
          )}
        </s-stack>
      </s-table-cell>

      {/* Status */}
      <s-table-cell>
        <StatusBadge status={record.status} />
      </s-table-cell>

      {/* Updated */}
      <s-table-cell>
        <s-text tone="neutral">
          {new Date(record.updatedAt).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </s-text>
      </s-table-cell>

      {/* Actions */}
      <s-table-cell>
        <s-stack direction="block" gap="small-100">
          {(record.status === "pending" || record.status === "rejected") && (
            <s-button
              variant="secondary"
              onClick={() => submit("generate")}
              {...(isGenerating ? { loading: true } : {})}
              disabled={isGenerating || undefined}
            >
              Generate
            </s-button>
          )}

          {(record.status === "generated" ||
            record.status === "approved" ||
            record.status === "published") && (
            <s-button
              variant="secondary"
              onClick={() => submit("regenerate")}
              {...(isGenerating ? { loading: true } : {})}
              disabled={isGenerating || undefined}
            >
              Regenerate
            </s-button>
          )}

          {record.status === "generated" && (
            <>
              <s-button
                variant="primary"
                onClick={() => submit("approve")}
                {...(isApproving ? { loading: true } : {})}
                disabled={isApproving || undefined}
              >
                Approve
              </s-button>
              <s-button
                variant="secondary"
                tone="critical"
                onClick={() => submit("reject")}
                {...(isRejecting ? { loading: true } : {})}
                disabled={isRejecting || undefined}
              >
                Reject
              </s-button>
            </>
          )}

          {record.status === "approved" && (
            <>
              <s-button
                variant="primary"
                onClick={() =>
                  submit("publish", {
                    generatedTitle: editTitle,
                    generatedDescription: editDesc,
                  })
                }
                {...(isPublishing ? { loading: true } : {})}
                disabled={(!canPublish || isPublishing) || undefined}
              >
                Publish
              </s-button>
              <s-button
                variant="secondary"
                tone="critical"
                onClick={() => submit("reject")}
                {...(isRejecting ? { loading: true } : {})}
                disabled={isRejecting || undefined}
              >
                Reject
              </s-button>
            </>
          )}

          {record.status === "failed" && (
            <s-badge tone="critical">Failed</s-badge>
          )}
        </s-stack>
      </s-table-cell>
    </s-table-row>
  );
}

// ─── Table ────────────────────────────────────────────────────────────────────

interface MetaTableProps {
  records: MetaRecord[];
  tone: Tone;
  resourceFilter: ResourceFilter;
  fetcher: FetcherWithComponents<unknown>;
  pageInfo: PageInfo;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  pageMode: "cursor" | "offset";
  currentPage: number;
}

export function MetaTable({
  records,
  tone,
  resourceFilter,
  fetcher,
  pageInfo,
  searchParams,
  setSearchParams,
  pageMode,
  currentPage,
}: MetaTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelectedIds(new Set());
  }, [records.length]);

  const allSelected =
    records.length > 0 && records.every((r) => selectedIds.has(r.resourceId));
  const someSelected =
    records.some((r) => selectedIds.has(r.resourceId)) && !allSelected;

  const handleSelectAll = useCallback(
    () => {
      setSelectedIds((prev) => {
        const allCurrentlySelected =
          records.length > 0 && records.every((r) => prev.has(r.resourceId));
        return allCurrentlySelected
          ? new Set()
          : new Set(records.map((r) => r.resourceId));
      });
    },
    [records],
  );

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      checked ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const submitBulk = (intent: string) => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const fd = new FormData();
    fd.set("_intent", intent);
    ids.forEach((id) => fd.append("resourceId", id));
    fd.set("resourceType", resourceFilter === "articles" ? "article" : "product");
    fd.set("tone", tone);
    fetcher.submit(fd, { method: "POST" });
    setSelectedIds(new Set());
  };

  // Which bulk action (if any) is currently in flight
  const inFlightIntent =
    fetcher.state !== "idle"
      ? (fetcher.formData?.get("_intent") as string | null)
      : null;
  const bulkInFlight = inFlightIntent?.startsWith("bulk_") ?? false;
  const isBulkAction = (intent: string) => inFlightIntent === intent;

  const exportCsv = () => {
    const rows =
      selectedIds.size === 0
        ? records
        : records.filter((r) => selectedIds.has(r.resourceId));
    const header =
      "type,title,handle,keyword,current_title,current_description,generated_title,generated_description,status,updated_at";
    const csvRows = rows.map((r) =>
      [
        r.resourceType,
        `"${r.title.replace(/"/g, '""')}"`,
        r.handle,
        r.keyword ?? "",
        `"${(r.currentSeoTitle ?? "").replace(/"/g, '""')}"`,
        `"${(r.currentSeoDescription ?? "").replace(/"/g, '""')}"`,
        `"${(r.generatedTitle ?? "").replace(/"/g, '""')}"`,
        `"${(r.generatedDescription ?? "").replace(/"/g, '""')}"`,
        r.status,
        r.updatedAt,
      ].join(","),
    );
    const csv = [header, ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-meta-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const navigate = (direction: "next" | "prev") => {
    const next = new URLSearchParams(searchParams);
    if (pageMode === "offset") {
      const newPage = direction === "next" ? currentPage + 1 : currentPage - 1;
      next.set("page", String(newPage));
      next.delete("after");
      next.delete("before");
    } else {
      if (direction === "next" && pageInfo.endCursor) {
        next.set("after", pageInfo.endCursor);
        next.delete("before");
        next.delete("page");
      } else if (direction === "prev" && pageInfo.startCursor) {
        next.set("before", pageInfo.startCursor);
        next.delete("after");
        next.delete("page");
      }
    }
    setSearchParams(next);
  };

  if (records.length === 0) {
    return (
      <s-banner tone="info" heading="No records found">
        Try adjusting your filters or search query.
      </s-banner>
    );
  }

  return (
    <s-stack direction="block" gap="base">
      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <s-box padding="base" borderWidth="base" borderRadius="base" background="subdued">
          <s-stack direction="block" gap="small-200">
            <s-text type="strong">
              {selectedIds.size} record{selectedIds.size !== 1 ? "s" : ""}{" "}
              selected
            </s-text>
            {/* Raw flex container so the buttons always wrap and stay visible,
                no matter how narrow the embedded admin viewport is. */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <s-button
                variant="primary"
                onClick={() => submitBulk("bulk_generate")}
                {...(isBulkAction("bulk_generate") ? { loading: true } : {})}
                disabled={bulkInFlight || undefined}
              >
                Bulk Generate
              </s-button>
              <s-button
                variant="primary"
                onClick={() => submitBulk("bulk_approve")}
                {...(isBulkAction("bulk_approve") ? { loading: true } : {})}
                disabled={bulkInFlight || undefined}
              >
                Bulk Approve
              </s-button>
              {/* <s-button
                variant="secondary"
                tone="critical"
                onClick={() => submitBulk("bulk_reject")}
                {...(isBulkAction("bulk_reject") ? { loading: true } : {})}
                disabled={bulkInFlight || undefined}
              >
                Bulk Reject
              </s-button>
              <s-button
                variant="primary"
                onClick={() => submitBulk("bulk_publish")}
                {...(isBulkAction("bulk_publish") ? { loading: true } : {})}
                disabled={bulkInFlight || undefined}
              >
                Bulk Publish
              </s-button> */}
              <s-button
                variant="secondary"
                onClick={exportCsv}
                disabled={bulkInFlight || undefined}
              >
                Export CSV
              </s-button>
            </div>
          </s-stack>
        </s-box>
      )}

      {selectedIds.size === 0 && (
        <s-stack direction="inline" justifyContent="end">
          <s-button variant="secondary" onClick={exportCsv}>
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
          <s-table-header>Type</s-table-header>
          <s-table-header listSlot="primary">Title / Handle</s-table-header>
          <s-table-header>Current SEO</s-table-header>
          <s-table-header>Keyword</s-table-header>
          <s-table-header>Generated Metadata</s-table-header>
          <s-table-header>Status</s-table-header>
          <s-table-header>Updated</s-table-header>
          <s-table-header>Actions</s-table-header>
        </s-table-header-row>
        <s-table-body>
          {records.map((record) => (
            <MetaRow
              key={record.resourceId}
              record={record}
              selected={selectedIds.has(record.resourceId)}
              tone={tone}
              onSelect={handleSelectOne}
              fetcher={fetcher}
            />
          ))}
        </s-table-body>
      </s-table>

      {/* Pagination */}
      <s-stack
        direction="inline"
        justifyContent="space-between"
        alignItems="center"
      >
        <s-text tone="neutral">{records.length} records on this page</s-text>
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="secondary"
            disabled={!pageInfo.hasPreviousPage || undefined}
            onClick={() => navigate("prev")}
          >
            Previous
          </s-button>
          <s-button
            variant="secondary"
            disabled={!pageInfo.hasNextPage || undefined}
            onClick={() => navigate("next")}
          >
            Next
          </s-button>
        </s-stack>
      </s-stack>
    </s-stack>
  );
}
