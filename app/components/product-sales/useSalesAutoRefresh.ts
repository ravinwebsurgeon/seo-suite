import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

/**
 * Stale-while-revalidate for the Product Sales sections.
 *
 * Loaders serve cached data instantly (fast first paint). On mount — i.e. a
 * full page reload or a tab/preset navigation — this hook checks how old that
 * cached data actually is and, if it's older than the threshold, silently
 * POSTs the `refresh` intent to the route action. That action force-refreshes
 * from Shopify and rewrites the cache; the fetcher submission then triggers an
 * automatic loader revalidation, so the view updates to fresh data with no
 * manual click.
 *
 * A short threshold keeps rapid tab-switching from hammering the Shopify API:
 * data fetched seconds ago is treated as current.
 *
 * @param cachedAt ISO timestamp of when the underlying data was last cached.
 * @param fields   Extra form fields for the refresh action (e.g. `{ preset }`),
 *                 so the correct date range is refreshed.
 * @returns whether an auto-refresh is currently in flight.
 */
const STALE_THRESHOLD_MS = 60_000;

export function useSalesAutoRefresh(
  cachedAt: string | null,
  fields: Record<string, string> = {},
): boolean {
  const fetcher = useFetcher();
  // Serialised so the effect re-evaluates when the target range changes.
  const fieldsKey = JSON.stringify(fields);
  // Track the last range we already handled so we fire at most once per
  // (reload / navigation) instead of looping when the loader revalidates.
  const handledKey = useRef<string | null>(null);

  useEffect(() => {
    if (!cachedAt) return;
    if (handledKey.current === fieldsKey) return;

    const ageMs = Date.now() - new Date(cachedAt).getTime();
    // Mark handled regardless, so a post-refresh revalidation doesn't re-trigger.
    handledKey.current = fieldsKey;
    if (Number.isNaN(ageMs) || ageMs < STALE_THRESHOLD_MS) return;

    const formData = new FormData();
    formData.set("_intent", "refresh");
    for (const [key, value] of Object.entries(JSON.parse(fieldsKey) as Record<string, string>)) {
      formData.set(key, value);
    }
    fetcher.submit(formData, { method: "post" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedAt, fieldsKey]);

  return fetcher.state !== "idle";
}
