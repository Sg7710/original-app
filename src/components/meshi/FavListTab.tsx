"use client";

import { useCallback, useMemo, useState } from "react";
import type { Store } from "@/types/store";
import type { LikeEntry } from "@/types/social";
import type { FavoriteEntry } from "@/hooks/useFavorites";
import { useStoreLookup } from "@/hooks/useStoreLookup";
import { LIKE_HISTORY_DAYS } from "@/hooks/useLikeHistory";
import type { Coords } from "@/hooks/useLocation";
import { FavListHeader, type FavView } from "./FavListHeader";
import { FavListMineView } from "./FavListMineView";
import { FavListHistoryView, type HistoryEntry } from "./FavListHistoryView";
import { dayLabel, TODAY } from "./DayHeader";

const HISTORY_LIMIT = 30;

interface FavListTabProps {
  favorites: FavoriteEntry[];
  /** false の間は「自分」のリストを Supabase から読み込み中 */
  favoritesLoaded: boolean;
  stores: Store[];
  coords: Coords | null;
  likeHistory: LikeEntry[];
  onRemove: (placeId: string) => void;
  onToggleFavorite: (placeId: string) => void;
  onAddMany: (placeIds: string[]) => void;
  /** 最初に開くタブ(投票ページの「アプリに戻る」からは「リスト」) */
  initialView?: FavView;
}

export function FavListTab({
  favorites,
  favoritesLoaded,
  stores,
  coords,
  likeHistory,
  onRemove,
  onToggleFavorite,
  onAddMany,
  initialView = "history",
}: FavListTabProps) {
  const [view, setView] = useState<FavView>(initialView);

  const searchedIds = useMemo(() => new Set(stores.map((s) => s.placeId)), [stores]);

  // 今回の検索に入っていない「食べたい」店は、店のIDで取り直す(徒歩時間つき)。
  const [openedAt] = useState(() => Date.now());
  // 「自分」タブはスワイプした日ごとに分ける(同じ店を何度もスワイプしていたら一番最近)。
  // いいね履歴は表示が7日分なだけで記録は残っているので、古い店の日付も分かる。
  // 履歴にない店(ほかの端末でスワイプした等)だけ、リストに入れた日で分ける。
  const swipedAt = useMemo(() => {
    const latest = new Map<string, number>();
    for (const e of likeHistory) {
      if ((latest.get(e.placeId) ?? -Infinity) < e.likedAt) latest.set(e.placeId, e.likedAt);
    }
    return latest;
  }, [likeHistory]);
  const [mineOpenDays, setMineOpenDays] = useState<ReadonlySet<string>>(() => new Set([TODAY]));
  const openMineDay = useCallback(
    (label: string) =>
      setMineOpenDays((prev) => (prev.has(label) ? prev : new Set(prev).add(label))),
    [],
  );
  // 取り直すのは「リスト」タブを開いていて、しかも開いている日付の店だけ(最初は「今日」だけ)。
  const mineLookup = useStoreLookup(
    favorites
      .filter((f) =>
        mineOpenDays.has(
          dayLabel(new Date(swipedAt.get(f.placeId) ?? f.addedAt), new Date(openedAt)),
        ),
      )
      .map((f) => f.placeId)
      .filter((id) => !searchedIds.has(id)),
    coords,
    view === "mine",
  );

  // いいね履歴は直近7日・最大30件だけを表示し、取り直すのはタブを開いたときだけ。
  // 同じ店は1行にまとめ、一番新しいいいねの時間と回数を出す(履歴は新しい順に並んでいる)。
  // 「自分」のリストに入れた店は「食べたい」から外す。「はずす」で「自分」から外せば、
  // いいねの記録は残っているので、スワイプした日のところに自動で戻る。
  const recentHistory = useMemo(() => {
    const since = openedAt - LIKE_HISTORY_DAYS * 86_400_000;
    const listed = new Set(favorites.map((f) => f.placeId));
    const byPlace = new Map<string, HistoryEntry>();
    for (const e of likeHistory) {
      if (e.likedAt < since || listed.has(e.placeId)) continue;
      const seen = byPlace.get(e.placeId);
      if (seen) seen.count += 1;
      else byPlace.set(e.placeId, { ...e, count: 1 });
    }
    return Array.from(byPlace.values()).slice(0, HISTORY_LIMIT);
  }, [likeHistory, favorites, openedAt]);
  // 見比べるために徒歩時間も出すので、現在地つきで取り直す。
  // 取り直すのは開いている日付の店だけ(最初は「今日」だけ)。閉じた日の分まで毎回取ると
  // Place Details の無料枠をすぐ使い切るため。
  const [openDays, setOpenDays] = useState<ReadonlySet<string>>(() => new Set([TODAY]));
  const historyLookup = useStoreLookup(
    recentHistory
      .filter((e) => openDays.has(dayLabel(new Date(e.likedAt), new Date(openedAt))))
      .map((e) => e.placeId)
      .filter((id) => !searchedIds.has(id)),
    coords,
    view === "history",
  );

  const knownStores = useMemo(
    () => [...stores, ...mineLookup.stores, ...historyLookup.stores],
    [stores, mineLookup.stores, historyLookup.stores],
  );

  const myFavoritePlaceIds = useMemo(() => new Set(favorites.map((f) => f.placeId)), [favorites]);

  function changeView(next: FavView) {
    setView(next);
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <FavListHeader
        view={view}
        onChangeView={changeView}
        mineCount={favorites.length}
        historyCount={recentHistory.length}
      />

      {view === "mine" && (
        <FavListMineView
          favorites={favorites}
          swipedAt={swipedAt}
          stores={knownStores}
          loading={mineLookup.loading || !favoritesLoaded}
          openDays={mineOpenDays}
          onOpenDay={openMineDay}
          onToggleDay={(label) =>
            setMineOpenDays((prev) => {
              const next = new Set(prev);
              if (next.has(label)) next.delete(label);
              else next.add(label);
              return next;
            })
          }
          onRemove={onRemove}
        />
      )}
      {view === "history" && (
        <FavListHistoryView
          history={recentHistory}
          stores={knownStores}
          loading={historyLookup.loading}
          openDays={openDays}
          onToggleDay={(label) =>
            setOpenDays((prev) => {
              const next = new Set(prev);
              if (next.has(label)) next.delete(label);
              else next.add(label);
              return next;
            })
          }
          myFavoritePlaceIds={myFavoritePlaceIds}
          onToggleMine={onToggleFavorite}
          onBulkAdd={(placeIds) => {
            onAddMany(placeIds);
            setView("mine");
          }}
        />
      )}
    </div>
  );
}
