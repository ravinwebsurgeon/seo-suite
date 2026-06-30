import { useState, useCallback } from "react";
import type { FetcherWithComponents } from "react-router";
import type { CsvImportRow, CsvImportValidation } from "../../types/meta-generator";

type ValidTone = "auto" | "critical" | "neutral" | "info" | "success" | "caution" | "warning";

// RFC-4180-ish tokenizer: handles quoted fields, commas and newlines inside
// quotes, and escaped quotes (""). Returns an array of records (each a string[]).
function tokenizeCsv(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field); field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      // Skip blank lines.
      if (record.length > 1 || record[0] !== "") records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.length > 1 || record[0] !== "") records.push(record);
  }
  return records;
}

function parseCsv(text: string): { rows: CsvImportRow[]; errors: string[] } {
  const errors: string[] = [];
  const rows: CsvImportRow[] = [];
  const records = tokenizeCsv(text.trim());

  if (records.length < 2) {
    errors.push("CSV must have a header row and at least one data row");
    return { rows, errors };
  }

  const header = records[0].map((h) => h.trim().toLowerCase());
  const handleIdx = header.indexOf("handle");
  const titleIdx = header.indexOf("title_tag");
  const descIdx = header.indexOf("meta_description");
  const typeIdx = header.indexOf("type");

  if (handleIdx === -1 || titleIdx === -1 || descIdx === -1) {
    errors.push("Missing required columns: handle, title_tag, meta_description");
    return { rows, errors };
  }

  const seen = new Set<string>();
  for (let i = 1; i < records.length; i++) {
    const cols = records[i];
    const handle = (cols[handleIdx] ?? "").trim();
    const titleTag = (cols[titleIdx] ?? "").trim();
    const metaDesc = (cols[descIdx] ?? "").trim();
    const type = typeIdx !== -1 ? (cols[typeIdx] ?? "").trim() : "product";

    if (!handle) {
      errors.push(`Row ${i + 1}: missing handle`);
      continue;
    }
    if (seen.has(handle)) {
      // Skip duplicate handles within the file (Step 8).
      errors.push(`Row ${i + 1}: duplicate handle "${handle}" (skipped)`);
      continue;
    }
    seen.add(handle);
    rows.push({
      handle,
      title_tag: titleTag,
      meta_description: metaDesc,
      type: type === "article" ? "article" : "product",
    });
  }
  return { rows, errors };
}

function validateRows(rows: CsvImportRow[]): CsvImportValidation {
  const valid: CsvImportRow[] = [];
  const errors: Array<{ row: number; handle: string; message: string }> = [];

  rows.forEach((row, i) => {
    const rowErrors: string[] = [];
    if (!row.title_tag) rowErrors.push("title_tag is required");
    if (!row.meta_description) rowErrors.push("meta_description is required");
    if (row.title_tag.length > 60)
      rowErrors.push(`title_tag exceeds 60 chars (${row.title_tag.length})`);
    if (row.meta_description.length > 160)
      rowErrors.push(
        `meta_description exceeds 160 chars (${row.meta_description.length})`,
      );

    if (rowErrors.length > 0) {
      errors.push({
        row: i + 1,
        handle: row.handle,
        message: rowErrors.join("; "),
      });
    } else {
      valid.push(row);
    }
  });

  return { valid, errors };
}

interface ImportExportProps {
  approvedCount: number;
  publishedCount: number;
  fetcher: FetcherWithComponents<{
    success?: boolean;
    intent?: string;
    error?: string;
    importedCount?: number;
    skippedCount?: number;
    invalidCount?: number;
    failedRows?: Array<{ row: number; handle: string; message: string }>;
  }>;
}

export function ImportExport({
  approvedCount,
  publishedCount,
  fetcher,
}: ImportExportProps) {
  const [preview, setPreview] = useState<CsvImportValidation | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [importMode, setImportMode] = useState<"replace" | "missing_only">(
    "missing_only",
  );
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { rows, errors } = parseCsv(text);
      setParseErrors(errors);
      setPreview(errors.length === 0 ? validateRows(rows) : null);
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file?.name.endsWith(".csv")) handleFile(file);
    },
    [handleFile],
  );

  const handleImport = () => {
    if (!preview || preview.valid.length === 0) return;
    const fd = new FormData();
    fd.set("_intent", "csv_import");
    fd.set("mode", importMode);
    fd.set("rows", JSON.stringify(preview.valid));
    fetcher.submit(fd, { method: "POST" });
  };

  const downloadTemplate = () => {
    const csv =
      "handle,title_tag,meta_description,type\nexample-product,Example Product - Buy Now,Discover our example product with great features and value.,product";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "seo-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const isImporting =
    fetcher.state !== "idle" &&
    fetcher.formData?.get("_intent") === "csv_import";

  const descTone = (len: number, max: number): ValidTone =>
    len > max ? "critical" : "neutral";

  return (
    <s-stack direction="block" gap="base">
      {/* ── Export ── */}
      <s-stack direction="block" gap="small-200">
        <s-heading>Export SEO Metadata</s-heading>
        <s-text tone="neutral">
          Download your current SEO metadata records as CSV for review or
          backup.
        </s-text>
        <s-text tone="neutral">
          {approvedCount} approved · {publishedCount} published
        </s-text>
        <s-button variant="secondary" onClick={downloadTemplate}>
          Download CSV Template
        </s-button>
      </s-stack>

      <s-divider />

      {/* ── Import ── */}
      <s-stack direction="block" gap="small-200">
        <s-heading>Import SEO Metadata</s-heading>
        <s-text tone="neutral">
          Upload a CSV with columns: handle, title_tag, meta_description, type
          (optional)
        </s-text>

        {/* Mode toggle */}
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant={importMode === "missing_only" ? "primary" : "secondary"}
            onClick={() => setImportMode("missing_only")}
          >
            Update Missing Only
          </s-button>
          <s-button
            variant={importMode === "replace" ? "primary" : "secondary"}
            onClick={() => setImportMode("replace")}
          >
            Replace Existing
          </s-button>
        </s-stack>

        {/* Drop zone */}
        <div
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          style={{
            border: `2px dashed ${dragOver ? "var(--p-color-border-focus)" : "var(--p-color-border)"}`,
            borderRadius: "8px",
            padding: "32px",
            textAlign: "center",
            background: dragOver
              ? "var(--p-color-bg-info-subdued)"
              : "var(--p-color-bg-surface-secondary)",
            cursor: "pointer",
            transition: "all 0.2s",
          }}
        >
          <s-stack direction="block" gap="small" alignItems="center">
            <s-icon type="import" />
            <s-text tone="neutral">Drag and drop a CSV file here, or</s-text>
            <label>
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
              <s-button
                variant="secondary"
                onClick={(e: Event) => {
                  const input = (e.target as HTMLElement)
                    .closest("label")
                    ?.querySelector("input");
                  input?.click();
                }}
              >
                Browse files
              </s-button>
            </label>
          </s-stack>
        </div>

        {/* Parse errors */}
        {parseErrors.length > 0 && (
          <s-banner tone="critical" heading="CSV format errors">
            <s-stack direction="block" gap="small-100">
              {parseErrors.map((err, i) => (
                <s-paragraph key={i}>• {err}</s-paragraph>
              ))}
            </s-stack>
          </s-banner>
        )}

        {/* Preview */}
        {preview && (
          <s-stack direction="block" gap="small-200">
            <s-stack direction="inline" gap="small-200">
              <s-badge tone="success">{preview.valid.length} valid rows</s-badge>
              {preview.errors.length > 0 && (
                <s-badge tone="critical">
                  {preview.errors.length} invalid rows
                </s-badge>
              )}
            </s-stack>

            {preview.errors.length > 0 && (
              <s-banner tone="warning" heading="Validation warnings">
                <s-stack direction="block" gap="small-100">
                  {preview.errors.slice(0, 10).map((err, i) => (
                    <s-paragraph key={i}>
                      Row {err.row} ({err.handle}): {err.message}
                    </s-paragraph>
                  ))}
                  {preview.errors.length > 10 && (
                    <s-paragraph>
                      …and {preview.errors.length - 10} more
                    </s-paragraph>
                  )}
                </s-stack>
              </s-banner>
            )}

            {preview.valid.length > 0 && (
              <s-stack direction="block" gap="small-200">
                <s-text>Preview (first 5 rows)</s-text>
                <s-table>
                  <s-table-header-row>
                    <s-table-header>Handle</s-table-header>
                    <s-table-header>Title Tag</s-table-header>
                    <s-table-header>Meta Description</s-table-header>
                    <s-table-header>Type</s-table-header>
                  </s-table-header-row>
                  <s-table-body>
                    {preview.valid.slice(0, 5).map((row, i) => (
                      <s-table-row key={i}>
                        <s-table-cell>
                          <s-text>{row.handle}</s-text>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack direction="block" gap="small-100">
                            <s-text>{row.title_tag}</s-text>
                            <s-text
                              tone={descTone(row.title_tag.length, 60)}
                            >
                              {row.title_tag.length}/60
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-stack direction="block" gap="small-100">
                            <s-text>{row.meta_description}</s-text>
                            <s-text
                              tone={descTone(
                                row.meta_description.length,
                                160,
                              )}
                            >
                              {row.meta_description.length}/160
                            </s-text>
                          </s-stack>
                        </s-table-cell>
                        <s-table-cell>
                          <s-badge tone="neutral">
                            {row.type ?? "product"}
                          </s-badge>
                        </s-table-cell>
                      </s-table-row>
                    ))}
                  </s-table-body>
                </s-table>
              </s-stack>
            )}

            <s-button
              variant="primary"
              onClick={handleImport}
              disabled={
                (preview.valid.length === 0 || isImporting) || undefined
              }
              {...(isImporting ? { loading: true } : {})}
            >
              {importMode === "replace"
                ? "Replace & Import"
                : "Import Missing Only"}{" "}
              ({preview.valid.length} rows)
            </s-button>
          </s-stack>
        )}

        {/* Result banner */}
        {fetcher.data?.intent === "csv_import" && fetcher.state === "idle" && (
          <s-banner
            tone={fetcher.data.success ? "success" : "critical"}
            heading={
              fetcher.data.success ? "Import complete" : "Import failed"
            }
          >
            {fetcher.data.success ? (
              <s-stack direction="block" gap="small-100">
                <s-paragraph>
                  {fetcher.data.importedCount} imported
                  {(fetcher.data.skippedCount ?? 0) > 0 ? `, ${fetcher.data.skippedCount} skipped` : ""}
                  {(fetcher.data.invalidCount ?? 0) > 0 ? `, ${fetcher.data.invalidCount} invalid` : ""}.
                </s-paragraph>
                {(fetcher.data.failedRows?.length ?? 0) > 0 && (
                  <s-stack direction="block" gap="small-100">
                    {fetcher.data.failedRows?.slice(0, 10).map((f, i) => (
                      <s-paragraph key={i}>
                        Row {f.row} ({f.handle}): {f.message}
                      </s-paragraph>
                    ))}
                    {(fetcher.data.failedRows?.length ?? 0) > 10 && (
                      <s-paragraph>…and {(fetcher.data.failedRows?.length ?? 0) - 10} more</s-paragraph>
                    )}
                  </s-stack>
                )}
              </s-stack>
            ) : (
              <s-paragraph>{fetcher.data.error}</s-paragraph>
            )}
          </s-banner>
        )}
      </s-stack>
    </s-stack>
  );
}
