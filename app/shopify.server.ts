import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  LogSeverity,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { DrizzleSessionStorage } from "./db/session-storage.server";

// Set SHOPIFY_LOG_LEVEL=debug to see the auth/session-token decisions in the
// terminal ("going to bounce page", "No valid session found", "Responding to
// invalid access token", "Authenticate returned a response"). Invaluable for
// diagnosing intermittent "Handling response" hangs. Defaults to Info.
const LOG_LEVELS: Record<string, LogSeverity> = {
  error: LogSeverity.Error,
  warning: LogSeverity.Warning,
  info: LogSeverity.Info,
  debug: LogSeverity.Debug,
};
const logLevel =
  LOG_LEVELS[(process.env.SHOPIFY_LOG_LEVEL || "").toLowerCase()] ??
  LogSeverity.Info;

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new DrizzleSessionStorage(),
  distribution: AppDistribution.AppStore,
  logger: { level: logLevel },
  future: {
    expiringOfflineAccessTokens: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.October25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
