"use client";

import { useCallback, useSyncExternalStore } from "react";
import { isMockStores } from "@/lib/meshi/dev-mode";
import { isMockPlaceId } from "@/lib/meshi/derived";

export interface FavoriteEntry {
  placeId: string;
  addedAt: number;
}

const STORAGE_KEY = "meshi:favorites";
const EMPTY: FavoriteEntry[] = [];
const listeners = new Set<() => void>();
let cache: FavoriteEntry[] = EMPTY;

function isFavoriteEntry(v: unknown): v is FavoriteEntry {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as FavoriteEntry).placeId === "string" &&
    typeof (v as FavoriteEntry).addedAt === "number"
  );
}

function sortByAddedAtDesc(entries: FavoriteEntry[]): FavoriteEntry[] {
  return [...entries].sort((a, b) => b.addedAt - a.addedAt);
}

function parse(raw: string | null): FavoriteEntry[] {
  if (!raw) return EMPTY;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    // Drop leftovers from the mock-store era when real stores are in use.
    const keepMock = isMockStores();
    return sortByAddedAtDesc(
      parsed.filter(isFavoriteEntry).filter((f) => keepMock || !isMockPlaceId(f.placeId)),
    );
  } catch {
    return EMPTY;
  }
}

function persist(next: FavoriteEntry[]) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — favorites just won't persist.
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

/** localStorage-backed favorites (place IDs + add time), newest first — see 設計書 §4.2. */
export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const addFavorite = useCallback((placeId: string) => {
    if (cache.some((f) => f.placeId === placeId)) return;
    persist(sortByAddedAtDesc([...cache, { placeId, addedAt: Date.now() }]));
  }, []);

  const removeFavorite = useCallback((placeId: string) => {
    persist(cache.filter((f) => f.placeId !== placeId));
  }, []);

  const toggleFavorite = useCallback((placeId: string) => {
    const exists = cache.some((f) => f.placeId === placeId);
    persist(
      exists
        ? cache.filter((f) => f.placeId !== placeId)
        : sortByAddedAtDesc([...cache, { placeId, addedAt: Date.now() }]),
    );
  }, []);

  return { favorites, addFavorite, removeFavorite, toggleFavorite };
}
