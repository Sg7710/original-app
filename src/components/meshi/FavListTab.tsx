"use client";

import { useMemo, useState } from "react";
import type { Store } from "@/types/store";
import type { LikeEntry } from "@/types/social";
import type { FavoriteEntry } from "@/hooks/useFavorites";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useStoreLookup } from "@/hooks/useStoreLookup";
import { LIKE_HISTORY_DAYS } from "@/hooks/useLikeHistory";
import type { Coords } from "@/hooks/useLocation";
import { MOCK_PEOPLE } from "@/lib/meshi/mock-people";
import { FavListHeader, type FavView } from "./FavListHeader";
import { FavListMineView } from "./FavListMineView";
import { FavListEveryoneView } from "./FavListEveryoneView";
import { FavListHistoryView, type HistoryEntry } from "./FavListHistoryView";
import { ProfilePopup } from "./ProfilePopup";

const HISTORY_LIMIT = 30;

interface FavListTabProps {
  favorites: FavoriteEntry[];
  stores: Store[];
  coords: Coords | null;
  likeHistory: LikeEntry[];
  onRemove: (placeId: string) => void;
  onToggleFavorite: (placeId: string) => void;
  onAddMany: (placeIds: string[]) => void;
  onOpenSettings: () => void;
}

export function FavListTab({
  favorites,
  stores,
  coords,
  likeHistory,
  onRemove,
  onToggleFavorite,
  onAddMany,
  onOpenSettings,
}: FavListTabProps) {
  const [view, setView] = useState<FavView>("history");
  const [menuOpen, setMenuOpen] = useState(false);
  const user = useCurrentUser();

  const searchedIds = useMemo(() => new Set(stores.map((s) => s.placeId)), [stores]);

  // 今回の検索に入っていない「食べたい」店は、店のIDで取り直す(徒歩時間つき)。
  const mineLookup = useStoreLookup(
    favorites.map((f) => f.placeId).filter((id) => !searchedIds.has(id)),
    coords,
    true,
  );

  // いいね履歴は直近7日・最大30件だけを表示し、取り直すのはタブを開いたときだけ。
  const [openedAt] = useState(() => Date.now());
  // 同じ店は1行にまとめ、一番新しいいいねの時間と回数を出す(履歴は新しい順に並んでいる)。
  const recentHistory = useMemo(() => {
    const since = openedAt - LIKE_HISTORY_DAYS * 86_400_000;
    const byPlace = new Map<string, HistoryEntry>();
    for (const e of likeHistory) {
      if (e.likedAt < since) continue;
      const seen = byPlace.get(e.placeId);
      if (seen) seen.count += 1;
      else byPlace.set(e.placeId, { ...e, count: 1 });
    }
    return Array.from(byPlace.values()).slice(0, HISTORY_LIMIT);
  }, [likeHistory, openedAt]);
  // 見比べるために徒歩時間も出すので、現在地つきで取り直す。
  const historyLookup = useStoreLookup(
    recentHistory.map((e) => e.placeId).filter((id) => !searchedIds.has(id)),
    coords,
    view === "history",
  );

  const knownStores = useMemo(
    () => [...stores, ...mineLookup.stores, ...historyLookup.stores],
    [stores, mineLookup.stores, historyLookup.stores],
  );

  const myFavoritePlaceIds = useMemo(() => new Set(favorites.map((f) => f.placeId)), [favorites]);

  const othersCount = useMemo(() => {
    const ids = new Set<string>();
    for (const person of MOCK_PEOPLE) {
      for (const id of person.wantIds) ids.add(id);
    }
    return ids.size;
  }, []);

  function changeView(next: FavView) {
    setView(next);
  }

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden">
      <FavListHeader
        view={view}
        onChangeView={changeView}
        userName={user.name}
        mineCount={favorites.length}
        othersCount={othersCount}
        historyCount={recentHistory.length}
        onOpenMenu={() => setMenuOpen(true)}
      />

      {view === "mine" && (
        <FavListMineView
          favorites={favorites}
          stores={knownStores}
          loading={mineLookup.loading}
          people={MOCK_PEOPLE}
          onRemove={onRemove}
        />
      )}
      {view === "others" && (
        <FavListEveryoneView
          stores={stores}
          people={MOCK_PEOPLE}
          myFavoritePlaceIds={myFavoritePlaceIds}
          onToggleMine={onToggleFavorite}
        />
      )}
      {view === "history" && (
        <FavListHistoryView
          history={recentHistory}
          stores={knownStores}
          loading={historyLookup.loading}
          myFavoritePlaceIds={myFavoritePlaceIds}
          onToggleMine={onToggleFavorite}
          onBulkAdd={(placeIds) => {
            onAddMany(placeIds);
            setView("mine");
          }}
        />
      )}

      {menuOpen && (
        <ProfilePopup
          name={user.name}
          favCount={favorites.length}
          likeCount={likeHistory.length}
          peopleCount={MOCK_PEOPLE.length}
          onClose={() => setMenuOpen(false)}
          onOpenSettings={() => {
            setMenuOpen(false);
            onOpenSettings();
          }}
        />
      )}
    </div>
  );
}
