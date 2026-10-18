"use client";

import { useState } from "react";
import type { Store } from "@/types/store";
import type { Person } from "@/types/social";
import type { FavoriteEntry } from "@/hooks/useFavorites";
import { Avatar } from "./Avatar";
import { PhotoViewer } from "./PhotoViewer";
import { DirectionsLink, OPEN_STATUS_LOOK, StoreDetailRow } from "./StoreDetailRow";
import { useStoreFilters } from "./StoreFilters";

interface FavListMineViewProps {
  favorites: FavoriteEntry[];
  stores: Store[];
  people: Person[];
  /** Saved stores outside the current search are still being re-fetched. */
  loading: boolean;
  onRemove: (placeId: string) => void;
}

/**
 * 「自分」タブ: 「食べたい」(いいね履歴)で吟味して、行くと決めた店の一覧。
 * 決めた店だけなので絞り込みは付けず、経路とはずすだけのシンプルな形にする。
 */
export function FavListMineView({
  favorites,
  stores,
  people,
  loading,
  onRemove,
}: FavListMineViewProps) {
  /** 写真を大きく見ているお店 */
  const [viewing, setViewing] = useState<Store | null>(null);
  // 絞り込みは付けないが、営業中 → まもなく開店 → … の並びと色分けは同じにする。
  const order = useStoreFilters();

  const favStores = order.apply(
    favorites
      .map((f) => stores.find((s) => s.placeId === f.placeId))
      .filter((s): s is Store => Boolean(s)),
  );

  if (favStores.length === 0 && loading) {
    return (
      <p className="flex-1 pt-10 text-center text-sm text-text-secondary">読み込んでいます…</p>
    );
  }

  if (favStores.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto px-5 pb-5 pt-1">
        <div
          className="flex flex-col items-center gap-1.5 rounded-[22px] px-6 py-20 text-center"
          style={{ border: "1px dashed rgba(26,24,19,0.16)" }}
        >
          <p className="text-sm font-bold text-text-primary">まだ空です</p>
          <p className="text-xs leading-[1.8] text-text-secondary">
            「食べたい」で見比べて、行きたい店を追加できます
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <ul className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 pb-5 pt-1">
        {favStores.map((store) => {
          const wanters = people.filter((p) => p.wantIds.includes(store.placeId));
          const status = order.statusOf(store);
          const look = OPEN_STATUS_LOOK[status];
          return (
            <li
              key={store.placeId}
              className="flex flex-col gap-2 rounded-[20px] border p-3"
              style={{ backgroundColor: look.background, borderColor: look.border }}
            >
              <StoreDetailRow
                store={store}
                status={status}
                onOpenPhoto={() => setViewing(store)}
                footer={
                  wanters.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="flex -space-x-1.5">
                        {wanters.map((p) => (
                          <Avatar key={p.id} name={p.name} color={p.color} size={22} />
                        ))}
                      </div>
                      <span className="text-[11px] font-bold text-[#8F5E10]">
                        {wanters.map((p) => p.name).join("・")}も食べたい
                      </span>
                    </div>
                  )
                }
                actions={
                  <>
                    <DirectionsLink store={store} />
                    <button
                      type="button"
                      onClick={() => onRemove(store.placeId)}
                      className="h-11 min-w-[64px] rounded-[22px] border border-[rgba(26,24,19,0.12)] px-3 text-[11px] font-bold text-[#8A8474]"
                    >
                      はずす
                    </button>
                  </>
                }
              />
            </li>
          );
        })}
      </ul>
      {viewing && <PhotoViewer store={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
