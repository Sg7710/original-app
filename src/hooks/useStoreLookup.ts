"use client";

import useSWR from "swr";
import type { Store } from "@/types/store";
import type { Coords } from "./useLocation";
import { isMockPlaceId } from "@/lib/meshi/derived";
import { FETCH_ONCE } from "./useStores";

/**
 * Session cache per place ID (and whether walk minutes were requested), so
 * removing a favorite or reopening a tab never re-fetches stores we already
 * have. null = Google no longer returns this place.
 */
const cache = new Map<string, Store | null>();

function cacheKey(placeId: string, withWalk: boolean) {
  return `${withWalk ? "walk" : "nowalk"}:${placeId}`;
}

/** A store fetched with walk minutes also serves callers that don't need them. */
function getCached(placeId: string, withWalk: boolean): Store | null | undefined {
  const walk = cache.get(cacheKey(placeId, true));
  return withWalk ? walk : (walk ?? cache.get(cacheKey(placeId, false)));
}

async function lookupStores(placeIds: string[], origin: Coords | null): Promise<void> {
  const res = await fetch("/api/stores/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ placeIds, origin }),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  const { stores } = (await res.json()) as { stores: Store[] };
  const found = new Map(stores.map((s) => [s.placeId, s]));
  for (const id of placeIds) cache.set(cacheKey(id, origin !== null), found.get(id) ?? null);
}

/**
 * Re-fetches saved stores that aren't in the current search (Google's terms
 * only let us keep place IDs). Pass `origin` to also get walk minutes. Only
 * IDs not fetched earlier this session are sent to the server.
 */
export function useStoreLookup(placeIds: string[], origin: Coords | null, enabled: boolean) {
  const withWalk = origin !== null;
  const ids = placeIds.filter((id) => !isMockPlaceId(id));
  const uncached = ids.filter((id) => getCached(id, withWalk) === undefined).sort();
  const key = enabled && uncached.length > 0 ? ["store-lookup", withWalk, uncached.join(",")] : null;

  const { error, isLoading } = useSWR(key, () => lookupStores(uncached, origin), FETCH_ONCE);

  const stores = ids
    .map((id) => getCached(id, withWalk))
    .filter((s): s is Store => Boolean(s));
  return { stores, loading: isLoading, failed: Boolean(error) };
}
