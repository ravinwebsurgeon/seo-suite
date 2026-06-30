import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLocation, NavLink, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import { PCDPermissionError } from "../types/product-sales";
import { PcdPermissionEmptyState } from "../components/product-sales/PcdPermissionEmptyState";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const TABS = [
  { label: "Dashboard", path: "/app/product-sales/dashboard" },
  { label: "Best Sellers", path: "/app/product-sales/best-sellers" },
  { label: "Zero Sales", path: "/app/product-sales/zero-sales" },
  { label: "High Demand", path: "/app/product-sales/high-demand" },
];

export default function ProductSalesLayout() {
  const location = useLocation();

  return (
    <s-page heading="Product Sales Intelligence">
      <s-section>
        <s-stack direction="inline" gap="small-200">
          {TABS.map((tab) => {
            const isActive =
              location.pathname === tab.path ||
              location.pathname.startsWith(tab.path + "/");
            return (
              <NavLink key={tab.path} to={tab.path} style={{ textDecoration: "none" }}>
                <s-button variant={isActive ? "primary" : "secondary"}>{tab.label}</s-button>
              </NavLink>
            );
          })}
        </s-stack>
      </s-section>
      <Outlet />
    </s-page>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (error instanceof Response) {
    return boundary.error(error);
  }

  // Catches: PCDPermissionError instance, name-matched Error, errorType object,
  // OR a plain Error thrown by the Shopify SDK with the PCD message
  if (PCDPermissionError.is(error)) {
    return (
      <s-page heading="Product Sales Intelligence">
        <PcdPermissionEmptyState />
      </s-page>
    );
  }

  return (
    <s-page heading="Product Sales Intelligence">
      <s-section>
        <s-banner tone="critical" heading="Something went wrong">
          An error occurred loading sales data. Please try again.
          {error instanceof Error && (
            <div style={{ marginTop: "8px", fontSize: "12px", opacity: 0.7 }}>
              {error.message}
            </div>
          )}
        </s-banner>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
