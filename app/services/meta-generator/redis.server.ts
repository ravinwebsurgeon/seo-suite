import Redis from "ioredis";

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export function getRedis(): Redis | null {
  if (!process.env.REDIS_URL) return null;
  if (!globalThis.__redis) {
    globalThis.__redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: false,
    });
    globalThis.__redis.on("error", (err: Error) => {
      console.error("[Redis] connection error:", err.message);
    });
  }
  return globalThis.__redis;
}

export function isRedisAvailable(): boolean {
  return Boolean(process.env.REDIS_URL);
}
