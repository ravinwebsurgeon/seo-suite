import type { elements } from "@shopify/polaris-types";
import type { DashboardStats } from "../../types/meta-generator";

type SIconType = NonNullable<InstanceType<typeof elements.Icon>["type"]>;
type STone = "neutral" | "critical" | "warning" | "success" | "info";

interface StatCardProps {
  label: string;
  value: number | string;
  tone?: STone;
  icon: SIconType;
}

function StatCard({ label, value, tone = "neutral", icon }: StatCardProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type={icon} />
          <s-text tone={tone === "neutral" ? "auto" : tone}>{label}</s-text>
        </s-stack>
        <s-heading>{String(value)}</s-heading>
        {tone !== "neutral" && Number(value) > 0 && (
          <s-badge tone={tone}>Needs attention</s-badge>
        )}
        {tone !== "neutral" && Number(value) === 0 && (
          <s-badge tone="success">All good</s-badge>
        )}
      </s-stack>
    </s-box>
  );
}

export function MetaDashboardCards({ stats }: { stats: DashboardStats }) {
  return (
    <s-stack direction="block" gap="base">
      {/* ── Products ── */}
      <s-section heading="Products">
        <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
          <s-grid-item>
            <StatCard label="Total Products" value={stats.products.total} icon="product" />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing SEO Title"
              value={stats.products.missingTitle}
              tone={stats.products.missingTitle > 0 ? "warning" : "neutral"}
              icon="alert-circle"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing Meta Desc"
              value={stats.products.missingDescription}
              tone={stats.products.missingDescription > 0 ? "warning" : "neutral"}
              icon="alert-circle"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing Both"
              value={stats.products.missingBoth}
              tone={stats.products.missingBoth > 0 ? "critical" : "neutral"}
              icon="alert-diamond"
            />
          </s-grid-item>
        </s-grid>
      </s-section>

      {/* ── Articles ── */}
      <s-section heading="Articles">
        <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
          <s-grid-item>
            <StatCard label="Total Articles" value={stats.articles.total} icon="blog" />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing SEO Title"
              value={stats.articles.missingTitle}
              tone={stats.articles.missingTitle > 0 ? "warning" : "neutral"}
              icon="alert-circle"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing Meta Desc"
              value={stats.articles.missingDescription}
              tone={stats.articles.missingDescription > 0 ? "warning" : "neutral"}
              icon="alert-circle"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Missing Both"
              value={stats.articles.missingBoth}
              tone={stats.articles.missingBoth > 0 ? "critical" : "neutral"}
              icon="alert-diamond"
            />
          </s-grid-item>
        </s-grid>
      </s-section>

      {/* ── AI Stats ── */}
      <s-section heading="AI Generation">
        <s-grid gridTemplateColumns="repeat(5, 1fr)" gap="base">
          <s-grid-item>
            <StatCard label="Generated" value={stats.ai.generated} icon="wand" tone="info" />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Pending Approval"
              value={stats.ai.pendingApproval}
              tone={stats.ai.pendingApproval > 0 ? "warning" : "neutral"}
              icon="clock"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard label="Approved" value={stats.ai.approved} tone="success" icon="check-circle" />
          </s-grid-item>
          <s-grid-item>
            <StatCard label="Published" value={stats.ai.published} icon="globe" tone="success" />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Failed"
              value={stats.ai.failed}
              tone={stats.ai.failed > 0 ? "critical" : "neutral"}
              icon="alert-diamond"
            />
          </s-grid-item>
        </s-grid>
      </s-section>

      {/* ── Queue Stats ── */}
      <s-section heading="Queue">
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          <s-grid-item>
            <StatCard
              label="Active Jobs"
              value={stats.queue.active}
              tone={stats.queue.active > 0 ? "info" : "neutral"}
              icon="refresh"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Completed Jobs"
              value={stats.queue.completed}
              icon="check-circle"
              tone="success"
            />
          </s-grid-item>
          <s-grid-item>
            <StatCard
              label="Failed Jobs"
              value={stats.queue.failed}
              tone={stats.queue.failed > 0 ? "critical" : "neutral"}
              icon="alert-diamond"
            />
          </s-grid-item>
        </s-grid>
      </s-section>
    </s-stack>
  );
}
