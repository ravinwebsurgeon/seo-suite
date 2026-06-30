import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { generateMeta } from "./claude.server";
import {
  updateJobProgress,
  updateMetaStatus,
  upsertMetaRecord,
  getKeyword,
  getMetaRecord,
} from "./db.server";
import { publishProductSeo, publishArticleSeo } from "./shopify.server";
import { QUEUE_NAME } from "./queue.server";
import type { MetaJobData } from "./queue.server";

let _worker: Worker | null = null;

// Build an admin-like GraphQL client from a raw shop domain + access token.
// The publish helpers (publishProductSeo / publishArticleSeo) expect an object
// with `.graphql(query, { variables })` returning a fetch Response — the same
// shape Shopify's app middleware provides in a request context. The worker runs
// outside any request, so we reconstruct that shape from the job's credentials.
function makeAdminGraphQL(shopDomain: string, accessToken: string) {
  return {
    graphql: (query: string, options?: { variables?: Record<string, unknown> }) =>
      fetch(`https://${shopDomain}/admin/api/2025-01/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables: options?.variables ?? {} }),
      }),
  };
}

function getBullMQConnection(): ConnectionOptions | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return {
    url,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  } as ConnectionOptions;
}

export function initWorker(): boolean {
  const conn = getBullMQConnection();
  if (!conn || _worker) return Boolean(_worker);

  _worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      const data = job.data as MetaJobData;
      const {
        shopId,
        accessToken,
        shopDomain,
        jobType,
        resourceIds,
        resourceType,
        tone,
      } = data;

      await updateJobProgress(data.jobId, { status: "processing" });

      const admin = makeAdminGraphQL(shopDomain, accessToken);
      let processed = 0;
      let failed = 0;

      for (const resourceId of resourceIds) {
        try {
          if (jobType === "meta-publish") {
            // Publish the already-approved meta to Shopify. Do NOT regenerate —
            // the user approved specific copy; we push exactly that. The values
            // live in the DB row created during generation/approval.
            const record = await getMetaRecord(shopId, resourceId);
            const seoTitle = record?.generatedTitle ?? "";
            const seoDescription = record?.generatedDescription ?? "";

            if (!seoTitle || !seoDescription) {
              throw new Error(
                "No generated title/description to publish (regenerate and approve first)",
              );
            }

            const result =
              resourceType === "product"
                ? await publishProductSeo(admin, resourceId, seoTitle, seoDescription)
                : await publishArticleSeo(admin, resourceId, seoTitle, seoDescription);

            if (!result.success) {
              throw new Error(result.error ?? "Shopify rejected the SEO update");
            }

            // Only mark published AFTER Shopify confirms the write.
            await updateMetaStatus(shopId, resourceId, "published");
          } else {
            // meta-generation: fetch the resource, generate copy, save as draft.
            const keyword = await getKeyword(shopId, resourceId);
            const numericId = resourceId.split("/").pop() ?? resourceId;
            const endpoint =
              resourceType === "product" ? "products" : "articles";
            const apiUrl = `https://${shopDomain}/admin/api/2025-01/${endpoint}/${numericId}.json`;

            const shopifyRes = await fetch(apiUrl, {
              headers: {
                "X-Shopify-Access-Token": accessToken,
                "Content-Type": "application/json",
              },
            });

            if (!shopifyRes.ok) {
              throw new Error(`Shopify API error: ${shopifyRes.status}`);
            }

            const shopifyData = (await shopifyRes.json()) as {
              product?: { title: string; body_html: string };
              article?: { title: string; body_html: string };
            };
            const resource =
              resourceType === "product"
                ? shopifyData.product
                : shopifyData.article;

            if (!resource) throw new Error("Resource not found");

            const generated = await generateMeta({
              title: resource.title,
              contentHtml: resource.body_html,
              keyword,
              tone,
              resourceType,
            });

            await upsertMetaRecord({
              shopId,
              resourceId,
              resourceType,
              generatedTitle: generated.title_tag,
              generatedDescription: generated.meta_description,
              tone,
              status: "generated",
            });
          }

          processed++;
          await updateJobProgress(data.jobId, {
            processedRecords: processed,
            failedRecords: failed,
          });

          // Respect Shopify rate limits: ~2 req/s
          await new Promise((resolve) => setTimeout(resolve, 600));
        } catch (err) {
          failed++;
          await updateMetaStatus(shopId, resourceId, "failed", String(err));
          await updateJobProgress(data.jobId, {
            processedRecords: processed,
            failedRecords: failed,
            errorLog: String(err),
          });
        }
      }

      const finalStatus =
        failed === resourceIds.length ? "failed" : "completed";
      await updateJobProgress(data.jobId, {
        status: finalStatus,
        processedRecords: processed,
        failedRecords: failed,
      });
    },
    {
      connection: conn,
      concurrency: 2,
    },
  );

  _worker.on("failed", (job, err) => {
    console.error(`[Worker] job ${job?.id} failed:`, err.message);
  });

  console.log("[Worker] SEO meta worker initialized");
  return true;
}
