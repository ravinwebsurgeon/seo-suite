import { Worker } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import { generateMeta } from "./claude.server";
import {
  updateJobProgress,
  updateMetaStatus,
  upsertMetaRecord,
  getKeyword,
} from "./db.server";
import { QUEUE_NAME } from "./queue.server";
import type { MetaJobData } from "./queue.server";

let _worker: Worker | null = null;

function getBullMQConnection(): ConnectionOptions | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url } as ConnectionOptions;
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

      await updateJobProgress(job.id ?? job.name, { status: "processing" });

      let processed = 0;
      let failed = 0;

      for (const resourceId of resourceIds) {
        try {
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
            status: jobType === "meta-publish" ? "published" : "generated",
          });

          processed++;
          await updateJobProgress(job.id ?? job.name, {
            processedRecords: processed,
            failedRecords: failed,
          });

          // Respect Shopify REST rate limit: ~2 req/s
          await new Promise((resolve) => setTimeout(resolve, 600));
        } catch (err) {
          failed++;
          await updateMetaStatus(shopId, resourceId, "failed", String(err));
          await updateJobProgress(job.id ?? job.name, {
            processedRecords: processed,
            failedRecords: failed,
            errorLog: String(err),
          });
        }
      }

      const finalStatus =
        failed === resourceIds.length ? "failed" : "completed";
      await updateJobProgress(job.id ?? job.name, {
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
