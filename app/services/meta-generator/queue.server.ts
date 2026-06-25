import { Queue } from "bullmq";
import type { ConnectionOptions } from "bullmq";
import type { JobType, Tone, ResourceType } from "../../types/meta-generator";

export const QUEUE_NAME = "seo-meta";

export interface MetaJobData {
  shopId: string;
  accessToken: string;
  shopDomain: string;
  jobDbId: number;
  jobType: JobType;
  resourceIds: string[];
  resourceType: ResourceType;
  tone: Tone;
}

let _queue: Queue | null = null;

function getBullMQConnection(): ConnectionOptions | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  return { url } as ConnectionOptions;
}

export function getQueue(): Queue | null {
  const conn = getBullMQConnection();
  if (!conn) return null;

  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: conn,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: { count: 500 },
        removeOnFail: { count: 200 },
      },
    });
  }
  return _queue;
}

export async function enqueueMetaJob(
  data: MetaJobData,
  jobId: string,
): Promise<boolean> {
  const queue = getQueue();
  if (!queue) return false;
  await queue.add(data.jobType, data, { jobId });
  return true;
}
