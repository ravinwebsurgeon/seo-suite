import type { FetcherWithComponents } from "react-router";
import type { SeoGenerationJob } from "../../db/schema";

type ValidTone = "auto" | "critical" | "neutral" | "info" | "success" | "caution" | "warning";

const JOB_STATUS_MAP: Record<string, { tone: ValidTone; label: string }> = {
  queued:     { tone: "neutral",  label: "Queued" },
  processing: { tone: "info",     label: "Processing" },
  completed:  { tone: "success",  label: "Completed" },
  failed:     { tone: "critical", label: "Failed" },
  cancelled:  { tone: "warning",  label: "Cancelled" },
};

function JobStatusBadge({ status }: { status: string }) {
  const cfg = JOB_STATUS_MAP[status] ?? { tone: "neutral" as ValidTone, label: status };
  return <s-badge tone={cfg.tone}>{cfg.label}</s-badge>;
}

function ProgressBar({ processed, total }: { processed: number; total: number }) {
  const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
  return (
    <s-stack direction="block" gap="small-100">
      <div
        style={{
          width: "100%",
          height: "6px",
          background: "var(--p-color-bg-fill-secondary)",
          borderRadius: "3px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--p-color-bg-fill-success)",
            transition: "width 0.3s ease",
          }}
        />
      </div>
      <s-text tone="neutral">
        {processed} / {total} ({pct}%)
      </s-text>
    </s-stack>
  );
}

interface JobsTableProps {
  jobs: SeoGenerationJob[];
  fetcher: FetcherWithComponents<unknown>;
}

export function JobsTable({ jobs, fetcher }: JobsTableProps) {
  if (jobs.length === 0) {
    return (
      <s-banner tone="info" heading="No jobs yet">
        Bulk generation jobs will appear here once you start processing.
      </s-banner>
    );
  }

  const submit = (intent: string, jobId: string) => {
    const fd = new FormData();
    fd.set("_intent", intent);
    fd.set("jobId", jobId);
    fetcher.submit(fd, { method: "POST" });
  };

  return (
    <s-table>
      <s-table-header-row>
        <s-table-header listSlot="primary">Job ID</s-table-header>
        <s-table-header>Type</s-table-header>
        <s-table-header>Status</s-table-header>
        <s-table-header>Progress</s-table-header>
        <s-table-header>Processed</s-table-header>
        <s-table-header>Failed</s-table-header>
        <s-table-header>Created</s-table-header>
        <s-table-header>Actions</s-table-header>
      </s-table-header-row>
      <s-table-body>
        {jobs.map((job) => (
          <s-table-row key={job.id}>
            <s-table-cell>
              <s-text tone="neutral">
                {job.jobId.length > 24 ? job.jobId.slice(0, 24) + "…" : job.jobId}
              </s-text>
            </s-table-cell>
            <s-table-cell>
              <s-badge tone="neutral">{job.jobType}</s-badge>
            </s-table-cell>
            <s-table-cell>
              <JobStatusBadge status={job.status} />
            </s-table-cell>
            <s-table-cell>
              <ProgressBar
                processed={job.processedRecords}
                total={job.totalRecords}
              />
            </s-table-cell>
            <s-table-cell>
              <s-text>{job.processedRecords.toString()}</s-text>
            </s-table-cell>
            <s-table-cell>
              <s-text tone={job.failedRecords > 0 ? "critical" : "auto"}>
                {job.failedRecords.toString()}
              </s-text>
            </s-table-cell>
            <s-table-cell>
              <s-text tone="neutral">
                {new Date(job.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </s-text>
            </s-table-cell>
            <s-table-cell>
              <s-stack direction="inline" gap="small-100">
                {job.status === "failed" && (
                  <s-button
                    variant="secondary"
                    onClick={() => submit("retry", job.jobId)}
                  >
                    Retry
                  </s-button>
                )}
                {(job.status === "queued" || job.status === "processing") && (
                  <s-button
                    variant="secondary"
                    tone="critical"
                    onClick={() => submit("cancel", job.jobId)}
                  >
                    Cancel
                  </s-button>
                )}
                {job.errorLog && (
                  <s-button
                    variant="tertiary"
                    onClick={() => alert(job.errorLog)}
                  >
                    View errors
                  </s-button>
                )}
              </s-stack>
            </s-table-cell>
          </s-table-row>
        ))}
      </s-table-body>
    </s-table>
  );
}
