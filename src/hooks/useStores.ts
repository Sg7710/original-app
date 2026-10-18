"use client";

import useSWR from "swr";
import type { Store } from "@/types/store";
import { MOVE_THRESHOLD_M, type Coords } from "./useLocation";
import { isMockStores } from "@/lib/meshi/dev-mode";
import { MOCK_STORES } from "@/lib/meshi/mock-stores";
import { straightDistance } from "@/lib/meshi/derived";

export type StoresStatus = "idle" | "loading" | "success" | "error";

/** Each search costs money, so never refetch on focus/reconnect — once per app open. */
export const FETCH_ONCE = {
  revalidateOnFocus: false,
  revalidateOnReconnect: false,
  revalidateIfStale: false,
  shouldRetryOnError: false,
} as const;

/** 毎回同じ空配列を返す(呼び出し側が「お店の一覧が変わったか」を === で見ているため)。 */
const NO_STORES: Store[] = [];

interface StoresResult {
  stores: Store[];
  /** The radius actually searched — the server widens 1500m→3000m when nothing is nearby. */
  radius: number;
}

/**
 * 直近の検索結果をこのタブの中だけ(sessionStorage)覚えておき、30分以内に
 * ほぼ同じ場所で開き直したら検索せずに使い回す。Googleの規約上お店の情報は
 * 長く保存できないので、タブを閉じたら消える sessionStorage にしている。
 */
// お店のデータの形を変えたら番号を上げる(古い形で保存された結果を使わないため)。
// v2: 営業中かどうか(openNow)を追加。v3: 公式ホームページ(websiteUrl)を追加。
// v4: 閉店時刻(closesAt)を追加。
const CACHE_KEY = "meshi:lastSearch:v4";
const CACHE_TTL_MS = 30 * 60 * 1000;

interface CachedSearch {
  lat: number;
  lng: number;
  savedAt: number;
  result: StoresResult;
}

/** 探した半径ごとに1件ずつ(「範囲を広げて探す」で上書きされないように)。 */
type SearchCache = Record<string, CachedSearch>;

function readCache(): SearchCache {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) ?? "{}");
    return typeof parsed === "object" && parsed !== null ? (parsed as SearchCache) : {};
  } catch {
    return {};
  }
}

function findCached(coords: Coords, radius: number): StoresResult | null {
  const hit = readCache()[radius];
  if (!hit || !hit.result || !Array.isArray(hit.result.stores)) return null;
  if (Date.now() - hit.savedAt > CACHE_TTL_MS) return null;
  if (straightDistance(hit, coords) >= MOVE_THRESHOLD_M) return null;
  return hit.result;
}

function saveCache(coords: Coords, radius: number, result: StoresResult) {
  const now = Date.now();
  const cache = readCache();
  // 期限切れは掃除してから書く
  for (const key of Object.keys(cache)) {
    if (now - cache[key].savedAt > CACHE_TTL_MS) delete cache[key];
  }
  cache[radius] = { lat: coords.lat, lng: coords.lng, savedAt: now, result };
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // 保存できなくても次回また検索するだけ
  }
}

async function searchStores(coords: Coords, radius: number): Promise<StoresResult> {
  const cached = findCached(coords, radius);
  if (cached) return cached;
  const result = await fetchStoresFromApi(coords.lat, coords.lng, radius);
  saveCache(coords, radius, result);
  return result;
}

async function fetchStoresFromApi(lat: number, lng: number, radius: number): Promise<StoresResult> {
  const res = await fetch("/api/stores", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, radius }),
  });
  if (!res.ok) throw new Error(`status ${res.status}`);
  return (await res.json()) as StoresResult;
}

/**
 * Fetches stores within `radius` of `coords` via SWR. Pass `radius: null` to
 * skip fetching. With mock stores on (see isMockStores()), returns MOCK_STORES
 * instead of calling the paid Places/Routes APIs. A search from (almost) the
 * same place within the last 30 minutes is reused instead of paid for again.
 */
export function useStores(coords: Coords | null, radius: number | null) {
  const mock = isMockStores();
  const key = coords && radius ? ["stores", coords.lat, coords.lng, radius, mock] : null;

  const { data, error, isLoading, mutate } = useSWR(
    key,
    () =>
      mock
        ? Promise.resolve({ stores: MOCK_STORES, radius: radius! })
        : searchStores(coords!, radius!),
    FETCH_ONCE,
  );

  const status: StoresStatus = !key
    ? "idle"
    : error
      ? "error"
      : isLoading || !data
        ? "loading"
        : "success";

  return {
    status,
    stores: data?.stores ?? NO_STORES,
    radius: data?.radius ?? null,
    retry: () => mutate(),
  };
}
