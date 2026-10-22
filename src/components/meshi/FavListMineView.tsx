"use client";

import { useState } from "react";
import type { Store } from "@/types/store";
import type { FavoriteEntry } from "@/hooks/useFavorites";
import { PhotoViewer } from "./PhotoViewer";
import { DirectionsLink, OPEN_STATUS_LOOK, StoreDetailRow } from "./StoreDetailRow";
import { useStoreFilters } from "./StoreFilters";
import { DayHeader, dayLabel } from "./DayHeader";
import { Roulette } from "./Roulette";
import { PollCreator } from "./PollCreator";
import { OpenPollsBanner } from "./OpenPollsBanner";
import { DoubleThumbsIcon } from "./DoubleThumbsIcon";

interface FavListMineViewProps {
  favorites: FavoriteEntry[];
  /** 店ごとの一番最近スワイプした時刻。日付の分け方に使う(ない店はリストに入れた日)。 */
  swipedAt: ReadonlyMap<string, number>;
  stores: Store[];
  /** Saved stores outside the current search are still being re-fetched. */
  loading: boolean;
  /** 開いている日付(見出しの文字)。ここに入っている日の店だけ取り直してある。 */
  openDays: ReadonlySet<string>;
  onToggleDay: (label: string) => void;
  /** その日を開く(閉じはしない)。ルーレットでまだ開いていない日を選んだとき用 */
  onOpenDay: (label: string) => void;
  onRemove: (placeId: string) => void;
}

interface DayGroup {
  label: string;
  date: Date;
  /** その日の店の数(まだ取り直していない店も含む) */
  entryCount: number;
  stores: Store[];
}

/**
 * 「自分」タブ: 「食べたい」(いいね履歴)で吟味して、行くと決めた店の一覧。
 * スワイプした日ごとに分け、今日の分は開いて、昨日より前は日付の見出しにたたむ。
 * 決めた店だけなので絞り込みは付けず、経路とはずすだけのシンプルな形にする。
 */
export function FavListMineView({
  favorites,
  swipedAt,
  stores,
  loading,
  openDays,
  onToggleDay,
  onOpenDay,
  onRemove,
}: FavListMineViewProps) {
  const [rouletteOpen, setRouletteOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  /** 投票を作ったら「投票中」の帯を読み直す */
  const [pollsVersion, setPollsVersion] = useState(0);
  /** 写真を大きく見ているお店 */
  const [viewing, setViewing] = useState<Store | null>(null);
  // 絞り込みは付けないが、営業中 → まもなく開店 → … の並びと色分けは同じにする。
  const order = useStoreFilters();

  // スワイプした日ごとにまとめる(新しい順)。日の中は営業中 → … の順。
  const now = new Date();
  const groups: DayGroup[] = [];
  const dated = favorites
    .map((f) => ({ ...f, at: swipedAt.get(f.placeId) ?? f.addedAt }))
    .sort((a, b) => b.at - a.at);
  for (const f of dated) {
    const date = new Date(f.at);
    const label = dayLabel(date, now);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, date, entryCount: 0, stores: [] };
      groups.push(group);
    }
    group.entryCount += 1;
    const store = stores.find((s) => s.placeId === f.placeId);
    if (store) group.stores.push(store);
  }
  for (const g of groups) g.stores = order.apply(g.stores);

  if (favorites.length === 0 && loading) {
    return (
      <p className="flex-1 pt-10 text-center text-sm text-text-secondary">読み込んでいます…</p>
    );
  }

  if (favorites.length === 0) {
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
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5 pt-1">
        <OpenPollsBanner version={pollsVersion} />
        {groups.map((group) => {
          const open = openDays.has(group.label);
          return (
            <section key={group.label} className="flex flex-col gap-2.5">
              <DayHeader
                label={group.label}
                date={group.date}
                count={group.entryCount}
                open={open}
                onToggle={() => onToggleDay(group.label)}
              />
              {open && group.stores.length === 0 && loading && (
                <p className="text-center text-xs text-text-tertiary">読み込んでいます…</p>
              )}
              {open && (
                <ul className="flex flex-col gap-3">
                  {group.stores.map((store) => {
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
              )}
            </section>
          );
        })}
      </div>
      {/* 一番下: リストの中から1軒決める(ひとりならルーレット、みんなでなら投票) */}
      <div className="flex shrink-0 gap-2.5 border-t border-card-border bg-app px-5 py-3">
        <button
          type="button"
          onClick={() => setRouletteOpen(true)}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[26px] bg-text-primary text-sm font-black text-white shadow-card"
        >
          <span aria-hidden>🎰</span>
          ルーレット
        </button>
        <button
          type="button"
          onClick={() => setPollOpen(true)}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[26px] bg-accent text-sm font-black text-text-primary shadow-card"
        >
          <DoubleThumbsIcon gapColor="var(--accent)" />
          みんなでスワイプ
        </button>
      </div>
      {pollOpen && (
        <PollCreator
          days={groups.map((g) => ({
            label: g.label,
            date: g.date,
            entryCount: g.entryCount,
            stores: g.stores,
            requested: openDays.has(g.label),
          }))}
          onNeedDay={onOpenDay}
          loading={loading}
          onCreated={() => setPollsVersion((v) => v + 1)}
          onClose={() => setPollOpen(false)}
        />
      )}
      {rouletteOpen && (
        <Roulette
          days={groups.map((g) => ({
            label: g.label,
            entryCount: g.entryCount,
            stores: g.stores,
            requested: openDays.has(g.label),
          }))}
          statusOf={order.statusOf}
          onNeedDay={onOpenDay}
          loading={loading}
          onClose={() => setRouletteOpen(false)}
        />
      )}
      {viewing && <PhotoViewer store={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
