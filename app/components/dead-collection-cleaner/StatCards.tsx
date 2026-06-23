import type { elements } from "@shopify/polaris-types";
import type { DashboardStats } from "../../types/dead-collection-cleaner";

type SIconType = NonNullable<InstanceType<typeof elements.Icon>["type"]>;

interface StatCardProps {
  label: string;
  value: number;
  tone?: "neutral" | "critical" | "warning" | "success";
  icon: SIconType;
}

function StatCard({ label, value, tone = "neutral", icon }: StatCardProps) {
  return (
    <s-box
      padding="base"
      borderWidth="base"
      borderRadius="base"
      background="base"
    >
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small" alignItems="center">
          <s-icon type={icon} />
          <s-text tone={tone === "neutral" ? "auto" : tone}>{label}</s-text>
        </s-stack>
        <s-heading>{value.toString()}</s-heading>
        {tone !== "neutral" && value > 0 && (
          <s-badge tone={tone}>{value > 0 ? "Needs attention" : "All good"}</s-badge>
        )}
      </s-stack>
    </s-box>
  );
}

interface StatCardsProps {
  stats: DashboardStats;
}

export function StatCards({ stats }: StatCardsProps) {
  return (
    <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
      <s-grid-item>
        <StatCard
          label="Total Collections"
          value={stats.totalCollections}
          icon="collection"
        />
      </s-grid-item>
      <s-grid-item>
        <StatCard
          label="Empty Collections"
          value={stats.emptyCollections}
          tone={stats.emptyCollections > 0 ? "warning" : "neutral"}
          icon="empty"
        />
      </s-grid-item>
      <s-grid-item>
        <StatCard
          label="Broken Automated"
          value={stats.brokenAutomated}
          tone={stats.brokenAutomated > 0 ? "critical" : "neutral"}
          icon="alert-circle"
        />
      </s-grid-item>
      <s-grid-item>
        <StatCard
          label="Orphan Products"
          value={stats.orphanProducts}
          tone={stats.orphanProducts > 0 ? "warning" : "neutral"}
          icon="product"
        />
      </s-grid-item>
    </s-grid>
  );
}
