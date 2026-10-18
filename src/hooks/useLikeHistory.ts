"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { LikeEntry } from "@/types/social";
import { isMockStores } from "@/lib/meshi/dev-mode";
import { isMockPlaceId } from "@/lib/meshi/derived";

const STORAGE_KEY = "meshi:likeHistory";
/** 「食べたい」(いいね履歴)に出すのは直近この日数ぶん。それより古いいいねは、スワイプにまた出る。 */
export const LIKE_HISTORY_DAYS = 7;
const EMPTY: LikeEntry[] = [];
const listeners = new Set<() => void>();
let cache: LikeEntry[] = EMPTY;

function isLikeEntry(v: unknown): v is LikeEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as LikeEntry).placeId === "string" &&
    typeof (v as LikeEntry).likedAt === "number"
  );
}

function sortByLikedAtDesc(entries: LikeEntry[]): LikeEntry[] {
  return [...entries].sort((a, b) => b.likedAt - a.likedAt);
}

function parse(raw: string | null): LikeEntry[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    // Drop leftovers from the mock-store era when real stores are in use.
    const keepMock = isMockStores();
    return sortByLikedAtDesc(
      parsed.filter(isLikeEntry).filter((e) => keepMock || !isMockPlaceId(e.placeId)),
    );
  } catch {
    return EMPTY;
  }
}

function persist(next: LikeEntry[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable — history just won't persist.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(callback: () => void) {
  cache = parse(window.localStorage.getItem(STORAGE_KEY));
  callback();

  function onStorage(event: StorageEvent) {
    if (event.key === STORAGE_KEY) {
      cache = parse(event.newValue);
      callback();
    }
  }

  window.addEventListener("storage", onStorage);
  listeners.add(callback);
  return () => {
    window.removeEventListener("storage", onStorage);
    listeners.delete(callback);
  };
}

function getSnapshot() {
  return cache;
}

function getServerSnapshot() {
  return EMPTY;
}

/**
 * 右スワイプ(食べたい)した履歴。favorites(はずすと消える)とは別物で、
 * 追記専用・削除されない(ハンドオフ仕様書: いいね履歴ビュー)。
 */
export function useLikeHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const recordLike = useCallback((placeId: string) => {
    persist(sortByLikedAtDesc([...cache, { placeId, likedAt: Date.now() }]));
  }, []);

  return { history, recordLike };
}
