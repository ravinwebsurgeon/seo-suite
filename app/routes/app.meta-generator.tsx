import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Outlet, useLocation, NavLink, useRouteError } from "react-router";
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

// Must delegate to `boundary.error`. Shopify's auth flow signals reauthorization
// by *throwing* a Response (an empty 401 with a retry header for data requests,
// or App Bridge HTML for document requests). A custom boundary that renders a
// static banner instead of calling `boundary.error` swallows that signal, so
// App Bridge never retries with a fresh session token — the module breaks until
// a manual refresh. Render our own UI only for genuine (non-Response) errors.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
