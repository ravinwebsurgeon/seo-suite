/**
 * Lightweight in-process rate limiter for spacing out Shopify Admin API calls.
 *
 * Shopify's Admin GraphQL API enforces a cost-based (leaky-bucket) rate limit.
 * Firing many mutations concurrently (e.g. `Promise.all(ids.map(...))`) can
 * exhaust the bucket and return `THROTTLED` errors. This helper dispatches
 * tasks at a bounded rate so bulk operations stay within the limit.
 */

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs the given async tasks while dispatching no more than `maxPerSecond` of
 * them per second. Tasks are started in order, spaced by a fixed interval, and
 * are allowed to overlap in flight — only the *start* rate is throttled.
 *
 * Results are returned in the same order as `tasks`. A task that throws does
 * not abort the queue; its slot resolves to a `rejected` settled result, so
 * callers can inspect partial success.
 *
 * @param tasks        Thunks that each begin one API call when invoked.
 * @param maxPerSecond Maximum number of tasks to dispatch per second (> 0).
 */
export async function runWithRateLimit<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  maxPerSecond: number,
): Promise<PromiseSettledResult<T>[]> {
  if (maxPerSecond <= 0) {
    throw new Error("runWithRateLimit: maxPerSecond must be greater than 0");
  }

  const intervalMs = 1000 / maxPerSecond;
  const inFlight: Promise<T>[] = [];

  for (let i = 0; i < tasks.length; i++) {
    // Space out dispatches; the first task starts immediately.
    if (i > 0) await sleep(intervalMs);
    inFlight.push(tasks[i]());
  }

  return Promise.allSettled(inFlight);
}
