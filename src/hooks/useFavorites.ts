"use client";

import { useCallback, useSyncExternalStore } from "react";
import { createClient } from "@/lib/supabase/client";
import { isMockStores } from "@/lib/meshi/dev-mode";
import { isMockPlaceId } from "@/lib/meshi/derived";

export interface FavoriteEntry {
  placeId: string;
  addedAt: number;
}

/**
 * 「自分」の食べたいリスト。ログイン中は Supabase の favorites テーブル
 * (supabase/schema.sql) に保存し、どの端末からでも同じリストになる。ログインしていない
 * とき(開発用のログインなしモード)と、お試しデータのときは、これまでどおり端末の中
 * (localStorage)に保存する。端末に残っていたリストは、ログイン後の最初の読み込みで
 * Supabase に移して端末側は消す。保存するのは Google の規約で許されている place ID だけ。
 */
const STORAGE_KEY = "meshi:favorites";
const EMPTY: FavoriteEntry[] = [];
const listeners = new Set<() => void>();

interface State {
  /** false の間はまだ読み込み中(空の一覧を「まだ空です」と出さないため)。 */
  loaded: boolean;
  favorites: FavoriteEntry[];
}

const INITIAL: State = { loaded: false, favorites: EMPTY };
let state: State = INITIAL;
/** ログイン中なら Supabase に保存する。 */
let remote = false;
let loading = false;

function emit(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

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

function readLocal(): FavoriteEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "[]");
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

function writeLocal(entries: FavoriteEntry[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — favorites just won't persist.
  }
}

async function loadRemote(): Promise<FavoriteEntry[] | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  // 端末に残っていたリストを Supabase に移す(同じ店は二重に入らない)。
  const local = readLocal();
  if (local.length > 0) {
    const { error } = await supabase.from("favorites").upsert(
      local.map((f) => ({ place_id: f.placeId, created_at: new Date(f.addedAt).toISOString() })),
      { onConflict: "user_id,place_id", ignoreDuplicates: true },
    );
    if (!error) window.localStorage.removeItem(STORAGE_KEY);
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("place_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    placeId: row.place_id as string,
    addedAt: Date.parse(row.created_at as string),
  }));
}

async function load() {
  if (loading) return;
  loading = true;
  // お試しデータの店(mock-…)は Supabase に入れない。
  if (!isMockStores()) {
    try {
      const fromRemote = await loadRemote();
      if (fromRemote) {
        remote = true;
        emit({ loaded: true, favorites: fromRemote });
        return;
      }
    } catch (err) {
      console.warn("[favorites] Supabase unavailable, using this device:", err);
    }
  }
  emit({ loaded: true, favorites: readLocal() });
}

/** 画面はすぐ変えて、保存はあとから。Supabase への保存に失敗したら読み込み直して元に戻す。 */
function save(next: FavoriteEntry[], change: { add?: string; remove?: string }) {
  emit({ loaded: true, favorites: next });
  if (!remote) {
    writeLocal(next);
    return;
  }
  const table = createClient().from("favorites");
  const request = change.add
    ? table.upsert(
        { place_id: change.add },
        { onConflict: "user_id,place_id", ignoreDuplicates: true },
      )
    : table.delete().eq("place_id", change.remove!);
  void request.then(({ error }) => {
    if (!error) return;
    console.warn("[favorites] could not save:", error.message);
    loading = false;
    void load();
  });
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  void load();

  function onStorage(event: StorageEvent) {
    if (!remote && event.key === STORAGE_KEY) emit({ loaded: true, favorites: readLocal() });
  }
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("storage", onStorage);
    listeners.delete(callback);
  };
}

/** 「自分」の食べたいリスト(place ID と追加した時刻)、新しい順。 */
export function useFavorites() {
  const current = useSyncExternalStore(
    subscribe,
    () => state,
    () => INITIAL,
  );

  const addFavorite = useCallback((placeId: string) => {
    const list = state.favorites;
    if (list.some((f) => f.placeId === placeId)) return;
    save(sortByAddedAtDesc([...list, { placeId, addedAt: Date.now() }]), { add: placeId });
  }, []);

  const removeFavorite = useCallback((placeId: string) => {
    save(
      state.favorites.filter((f) => f.placeId !== placeId),
      { remove: placeId },
    );
  }, []);

  const toggleFavorite = useCallback(
    (placeId: string) => {
      if (state.favorites.some((f) => f.placeId === placeId)) removeFavorite(placeId);
      else addFavorite(placeId);
    },
    [addFavorite, removeFavorite],
  );

  return {
    favorites: current.favorites,
    loaded: current.loaded,
    addFavorite,
    removeFavorite,
    toggleFavorite,
  };
}
