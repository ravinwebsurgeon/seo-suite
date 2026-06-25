import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLocation, NavLink } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

const TABS = [
  { label: "Dashboard", path: "/app/meta-generator/dashboard" },
  { label: "Editor", path: "/app/meta-generator/editor" },
  { label: "Jobs", path: "/app/meta-generator/jobs" },
  { label: "Import / Export", path: "/app/meta-generator/import-export" },
];

export default function MetaGeneratorLayout() {
  const location = useLocation();

  return (
    <s-page heading="Bulk Meta Generator / Editor">
      <s-section>
        <s-stack direction="inline" gap="small-200">
          {TABS.map((tab) => {
            const isActive = location.pathname === tab.path || location.pathname.startsWith(tab.path + "/");
            return (
              <NavLink key={tab.path} to={tab.path} style={{ textDecoration: "none" }}>
                <s-button variant={isActive ? "primary" : "secondary"}>
                  {tab.label}
                </s-button>
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
  return (
    <s-page heading="Bulk Meta Generator / Editor">
      <s-section>
        <s-banner tone="critical" heading="Something went wrong">
          An error occurred. Please try again.
        </s-banner>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
