
import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useRouteError } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

// In practice `authenticate.admin()` always throws (a redirect, the bounce page,
// or the exit-iframe page) for the paths this splat handles, so this component
// rarely renders. It exists so React Router doesn't warn about — and render — an
// empty page when a matched leaf route has no element.
export default function Auth() {
  return null;
}

// The session-token bounce page and exit-iframe page are served by this route:
// `authenticate.admin()` *throws* a Response whose body is the App Bridge
// <script> tag (see renderAppBridge in the Shopify package). React Router only
// surfaces that thrown body through an ErrorBoundary, and `boundary.error`
// renders `error.data` as HTML. Without this boundary, the thrown bounce
// response never renders the App Bridge script, so the embedded frame hangs on
// "Handling response" on cold loads / after a session token expires.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
