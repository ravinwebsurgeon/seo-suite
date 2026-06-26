import type { SalesSummary } from "../../types/product-sales";

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtCurrency(n: number): string {
  return "$" + fmt(n, 2);
}

interface CardProps {
  label: string;
  value: string;
  icon: string;
  tone?: "neutral" | "info" | "success" | "warning" | "critical";
  sub?: string;
}

function Card({ label, value, icon, tone = "neutral", sub }: CardProps) {
  return (
    <s-box padding="base" borderWidth="base" borderRadius="base" background="base">
      <s-stack direction="block" gap="small">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type={icon as never} />
          <s-text tone={tone === "neutral" ? "auto" : tone}>{label}</s-text>
        </s-stack>
        <s-heading>{value}</s-heading>
        {sub && <s-text>{sub}</s-text>}
      </s-stack>
    </s-box>
  );
}

interface SummaryCardsProps {
  summary: SalesSummary;
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  const avgOrder = summary.totalOrders > 0
    ? summary.totalRevenue / summary.totalOrders
    : 0;

  return (
    <s-stack direction="block" gap="base">
      <s-section heading="Sales Metrics">
        <s-grid gridTemplateColumns="repeat(4, 1fr)" gap="base">
          <s-grid-item>
            <Card label="Total Revenue" value={fmtCurrency(summary.totalRevenue)} icon="money" tone="success" />
          </s-grid-item>
          <s-grid-item>
            <Card label="Total Orders" value={fmt(summary.totalOrders)} icon="orders" />
          </s-grid-item>
          <s-grid-item>
            <Card label="Units Sold" value={fmt(summary.totalUnitsSold)} icon="product" />
          </s-grid-item>
          <s-grid-item>
            <Card label="Avg. Order Value" value={fmtCurrency(avgOrder)} icon="analytics" />
          </s-grid-item>
        </s-grid>
      </s-section>

      <s-section heading="Product Metrics">
        <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
          <s-grid-item>
            <Card
              label="Best Sellers"
              value={fmt(summary.bestSellerCount)}
              icon="star"
              tone="success"
              sub="Variants with at least 1 sale"
            />
          </s-grid-item>
          <s-grid-item>
            <Card
              label="Zero Sales"
              value={fmt(summary.zeroSaleCount)}
              icon="alert-circle"
              tone={summary.zeroSaleCount > 0 ? "warning" : "neutral"}
              sub="Variants with no sales in selected period"
            />
          </s-grid-item>
          <s-grid-item>
            <Card
              label="High Demand"
              value={fmt(summary.highDemandCount)}
              icon="alert-diamond"
              tone={summary.highDemandCount > 0 ? "critical" : "neutral"}
              sub="Risk of stock-out (last 14 days)"
            />
          </s-grid-item>
        </s-grid>
      </s-section>
    </s-stack>
  );
}
