"use client";

import { useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { isAuthBypassed } from "@/lib/meshi/dev-mode";
import type { DeckKind } from "@/lib/meshi/open-status";

export type SearchRadius = 1500 | 3000 | 5000;
export type MaxPriceTier = 1 | 2 | 3 | null;
/** お店までの時間を何で行く前提で出すか(表示と「経路」だけに使い、検索には影響しない)。 */
export type TravelMode = "walk" | "bike" | "car";

export interface SearchSettings {
  radiusM: SearchRadius;
  /** Highest price band to show (see Store.priceTier); null = no limit. */
  maxPriceTier: MaxPriceTier;
  travelMode: TravelMode;
  /** スワイプに出すお店の種類(営業中・まもなく開店・まもなく閉店)。最低1つは true。 */
  deckKinds: Record<DeckKind, boolean>;
}

export interface Account {
  /** False until the saved settings have been read — don't search before then. */
  loaded: boolean;
  /** Name shown in the app: the user's own display name, else one derived from their login. */
  name: string;
  displayName: string | null;
  email: string | null;
  settings: SearchSettings;
}

export const DEFAULT_DECK_KINDS: Record<DeckKind, boolean> = {
  open: true,
  opensSoon: false,
  closesSoon: false,
};
export const DEFAULT_SETTINGS: SearchSettings = {
  radiusM: 1500,
  maxPriceTier: null,
  travelMode: "walk",
  deckKinds: DEFAULT_DECK_KINDS,
};
const TRAVEL_MODES: TravelMode[] = ["walk", "bike", "car"];
const RADII: SearchRadius[] = [1500, 3000, 5000];
const LOCAL_KEY = "meshi:account";

const INITIAL: Account = {
  loaded: false,
  name: "ゲスト",
  displayName: null,
  email: null,
  settings: DEFAULT_SETTINGS,
};

let cache: Account = INITIAL;
let fallbackName = "ゲスト";
/** No Supabase user (dev login bypass): persist to localStorage instead. */
let useLocal = false;
let loading = false;
const listeners = new Set<() => void>();

function emit(next: Account) {
  cache = next;
  listeners.forEach((l) => l());
}

function parseSettings(raw: unknown): SearchSettings {
  const s = (raw ?? {}) as Partial<SearchSettings>;
  return {
    radiusM: RADII.includes(s.radiusM as SearchRadius) ? (s.radiusM as SearchRadius) : 1500,
    maxPriceTier: [1, 2, 3].includes(s.maxPriceTier as number)
      ? (s.maxPriceTier as MaxPriceTier)
      : null,
    travelMode: TRAVEL_MODES.includes(s.travelMode as TravelMode)
      ? (s.travelMode as TravelMode)
      : "walk",
    deckKinds: parseDeckKinds(s.deckKinds),
  };
}

function parseDeckKinds(raw: unknown): Record<DeckKind, boolean> {
  const k = (raw ?? {}) as Partial<Record<DeckKind, unknown>>;
  const kinds = {
    open: k.open === true,
    opensSoon: k.opensSoon === true,
    closesSoon: k.closesSoon === true,
  };
  // まだ選んだことがない(古い保存データ)か、全部外れていたら初期の「営業中だけ」
  return kinds.open || kinds.opensSoon || kinds.closesSoon ? kinds : DEFAULT_DECK_KINDS;
}

function withName(a: Omit<Account, "name">): Account {
  return { ...a, name: a.displayName?.trim() || fallbackName };
}

async function load() {
  if (loading) return;
  loading = true;

  if (!isAuthBypassed()) {
    const { data } = await createClient().auth.getUser();
    const user = data.user;
    if (user) {
      const meta = (user.user_metadata ?? {}) as {
        display_name?: string;
        full_name?: string;
        name?: string;
        meshi_settings?: unknown;
      };
      fallbackName = meta.full_name || meta.name || user.email?.split("@")[0] || "ユーザー";
      emit(
        withName({
          loaded: true,
          displayName: meta.display_name ?? null,
          email: user.email ?? null,
          settings: parseSettings(meta.meshi_settings),
        }),
      );
      return;
    }
  }

  useLocal = true;
  let saved: { displayName?: string | null; settings?: unknown } = {};
  try {
    saved = JSON.parse(window.localStorage.getItem(LOCAL_KEY) ?? "{}");
  } catch {
    // unreadable — fall back to defaults
  }
  emit(
    withName({
      loaded: true,
      displayName: saved.displayName ?? null,
      email: null,
      settings: parseSettings(saved.settings),
    }),
  );
}

async function persist(next: Account) {
  if (useLocal) {
    try {
      window.localStorage.setItem(
        LOCAL_KEY,
        JSON.stringify({ displayName: next.displayName, settings: next.settings }),
      );
    } catch {
      // storage unavailable — the change just won't survive a reload
    }
    return;
  }
  // `display_name` is our own key: Supabase refreshes full_name/name from
  // Google on each sign-in, which would overwrite a user-chosen name.
  const { error } = await createClient().auth.updateUser({
    data: { display_name: next.displayName, meshi_settings: next.settings },
  });
  if (error) throw error;
}

/** Updates the screen immediately, then saves (to the account, or this device in dev). */
export async function saveSettings(settings: SearchSettings) {
  const next = { ...cache, settings };
  emit(next);
  await persist(next);
}

/**
 * 移動手段だけをすぐ保存する。表示が変わるだけで探し直しは要らないので、
 * 「この条件でお店を探す」を待たずに反映する(距離・予算の下書きには触れない)。
 */
export async function saveTravelMode(travelMode: TravelMode) {
  await saveSettings({ ...cache.settings, travelMode });
}

export async function saveDisplayName(displayName: string) {
  const next = withName({ ...cache, displayName: displayName.trim() || null });
  emit(next);
  await persist(next);
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  void load();
  return () => listeners.delete(callback);
}

/** The signed-in user's name, email and swipe settings, shared app-wide. */
export function useAccount(): Account {
  return useSyncExternalStore(
    subscribe,
    () => cache,
    () => INITIAL,
  );
}
