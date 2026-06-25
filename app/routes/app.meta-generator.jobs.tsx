import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useRevalidator } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";
import { getJobsByShop, updateJobStatus } from "../services/meta-generator/db.server";
import { JobsTable } from "../components/meta-generator/JobsTable";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const jobs = await getJobsByShop(shopId);
  return { jobs };
};

// ─── Action ──────────────────────────────────────────────────────────────────

type ActionResult = { success: boolean; intent: string; error?: string };

export const action = async ({ request }: ActionFunctionArgs): Promise<ActionResult> => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;
  const formData = await request.formData();
  const intent = formData.get("_intent") as string;
  const jobId = formData.get("jobId") as string;

  if (intent === "cancel") {
    try {
      await updateJobStatus(jobId, "cancelled");
      return { success: true, intent };
    } catch (err) {
      return { success: false, intent, error: String(err) };
    }
  }

  if (intent === "retry") {
    try {
      await updateJobStatus(jobId, "queued");
      return { success: true, intent };
    } catch (err) {
      return { success: false, intent, error: String(err) };
    }
  }

  return { success: false, intent: "unknown", error: "Unknown action" };
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function MetaJobs() {
  const { jobs } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<ActionResult>();
  const revalidator = useRevalidator();
  const shopify = useAppBridge();

  useEffect(() => {
    if (fetcher.state !== "idle" || !fetcher.data) return;
    if (fetcher.data.success) {
      const messages: Record<string, string> = {
        cancel: "Job cancelled",
        retry: "Job requeued",
      };
      shopify.toast.show(messages[fetcher.data.intent] ?? "Done");
      revalidator.revalidate();
    } else {
      shopify.toast.show(fetcher.data.error ?? "Something went wrong", { isError: true });
    }
  }, [fetcher.data, fetcher.state, shopify, revalidator]);

  return (
    <>
      <s-section>
        <s-stack direction="inline" justifyContent="space-between" alignItems="center">
          <s-heading>Generation Jobs</s-heading>
          <s-button
            variant="secondary"
            onClick={() => revalidator.revalidate()}
            {...(revalidator.state === "loading" ? { loading: true } : {})}
          >
            Refresh
          </s-button>
        </s-stack>
      </s-section>

      <s-section>
        <JobsTable
          jobs={jobs}
          fetcher={fetcher}
        />
      </s-section>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
