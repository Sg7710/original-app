"use client";

import { useEffect, useSyncExternalStore } from "react";
import type { Coords } from "./useLocation";
import type { TravelMode } from "./useAccount";
import { isMockStores } from "@/lib/meshi/dev-mode";
import { isMockPlaceId } from "@/lib/meshi/derived";

/**
 * Real-road travel minutes (Routes API, via /api/travel-times) for the stores on
 * screen. Requests from all cards/rows rendered together are batched into one
 * call, and results are kept for this page session per origin + mode + store, so
 * each store is billed once per place and mode.
 *
 * Values: number = minutes, null = Google couldn't route it (use the estimate),
 * undefined = not known yet.
 */
const BATCH_DELAY_MS = 40;
const BATCH_SIZE = 25;

let originKey: string | null = null;
const minutes = new Map<string, number | null>();
/** Keys waiting for the next batch or already sent and not answered yet. */
const pending = new Set<string>();
const listeners = new Set<() => void>();
let flushTimer: number | null = null;

function keyOf(origin: string, mode: TravelMode, placeId: string): string {
  return `${origin}|${mode}|${placeId}`;
}

function notify() {
  listeners.forEach((l) => l());
}

/** MeshiApp calls this with the location stores were searched from. */
export function setTravelOrigin(next: Coords | null) {
  // ~10 m precision: GPS jitter below that shouldn't re-bill every store.
  const key = next ? `${next.lat.toFixed(4)},${next.lng.toFixed(4)}` : null;
  if (key === originKey) return;
  originKey = key;
  notify();
}

async function send(origin: string, mode: TravelMode, placeIds: string[]) {
  const [lat, lng] = origin.split(",").map(Number);
  let found: Record<string, number> = {};
  try {
    const res = await fetch("/api/travel-times", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: { lat, lng }, placeIds, mode }),
    });
    if (res.ok) found = ((await res.json()) as { minutes: Record<string, number> }).minutes;
  } catch {
    // network trouble: fall back to the estimate for these stores
  }
  for (const id of placeIds) {
    const key = keyOf(origin, mode, id);
    minutes.set(key, found[id] ?? null);
    pending.delete(key);
  }
  notify();
}

/** Batches waiting keys by origin + mode. */
let waiting: { origin: string; mode: TravelMode; placeId: string }[] = [];

function flush() {
  flushTimer = null;
  const groups = new Map<string, { origin: string; mode: TravelMode; ids: string[] }>();
  for (const w of waiting) {
    const g = groups.get(`${w.origin}|${w.mode}`) ?? { origin: w.origin, mode: w.mode, ids: [] };
    g.ids.push(w.placeId);
    groups.set(`${w.origin}|${w.mode}`, g);
  }
  waiting = [];
  for (const g of groups.values()) {
    for (let i = 0; i < g.ids.length; i += BATCH_SIZE) {
      void send(g.origin, g.mode, g.ids.slice(i, i + BATCH_SIZE));
    }
  }
}

function request(placeId: string, mode: TravelMode) {
  if (!originKey || isMockStores() || isMockPlaceId(placeId)) return;
  const key = keyOf(originKey, mode, placeId);
  if (minutes.has(key) || pending.has(key)) return;
  pending.add(key);
  waiting.push({ origin: originKey, mode, placeId });
  if (flushTimer === null) flushTimer = window.setTimeout(flush, BATCH_DELAY_MS);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function useTravelMinutes(placeId: string, mode: TravelMode): number | null | undefined {
  const origin = useSyncExternalStore(
    subscribe,
    () => originKey,
    () => null,
  );
  const value = useSyncExternalStore(
    subscribe,
    () => (originKey ? minutes.get(keyOf(originKey, mode, placeId)) : undefined),
    () => undefined,
  );
  useEffect(() => {
    request(placeId, mode);
  }, [placeId, mode, origin]);
  return value;
}
