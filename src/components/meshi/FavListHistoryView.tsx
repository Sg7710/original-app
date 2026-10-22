"use client";

import { useState } from "react";
import type { Store } from "@/types/store";
import type { LikeEntry } from "@/types/social";
import { PhotoViewer } from "./PhotoViewer";
import { DirectionsLink, OPEN_STATUS_LOOK, StoreDetailRow } from "./StoreDetailRow";
import { NoMatchingStores, StoreFilterBar, useStoreFilters } from "./StoreFilters";
import { DayHeader, dayLabel, TODAY } from "./DayHeader";

/** 店ごとにまとめた履歴の1行: 一番新しいいいねと、いいねした回数。 */
export interface HistoryEntry extends LikeEntry {
  count: number;
}

interface FavListHistoryViewProps {
  history: HistoryEntry[];
  stores: Store[];
  /** Liked stores outside the current search are still being re-fetched. */
  loading: boolean;
  /** 開いている日付(見出しの文字)。ここに入っている日の店だけ取り直してある。 */
  openDays: ReadonlySet<string>;
  onToggleDay: (label: string) => void;
  myFavoritePlaceIds: Set<string>;
  onToggleMine: (placeId: string) => void;
  onBulkAdd: (placeIds: string[]) => void;
}

interface DayGroup {
  label: string;
  date: Date;
  /** その日にいいねした店の数(まだ取り直していない店も含む) */
  entryCount: number;
  rows: { entry: HistoryEntry; store: Store }[];
}

/**
 * 「食べたい」タブ: 右スワイプした店を見比べて、気になる店を「自分」のリストに入れる場所。
 * 今日の分だけ開いておき、昨日より前は日付を押すと開く(履歴は7日で消える)。
 */
export function FavListHistoryView({
  history,
  stores,
  loading,
  openDays,
  onToggleDay,
  myFavoritePlaceIds,
  onToggleMine,
  onBulkAdd,
}: FavListHistoryViewProps) {
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [viewing, setViewing] = useState<Store | null>(null);
  const filters = useStoreFilters();

  // 日付ごとにまとめる(履歴は新しい順なので、日付も新しい順になる)。
  // 閉じている日の店はまだ取り直していないので、見出しと件数だけ出す。
  const now = new Date();
  const groups: DayGroup[] = [];
  for (const entry of history) {
    const date = new Date(entry.likedAt);
    const label = dayLabel(date, now);
    let group = groups.find((g) => g.label === label);
    if (!group) {
      group = { label, date, entryCount: 0, rows: [] };
      groups.push(group);
    }
    group.entryCount += 1;
    const store = stores.find((s) => s.placeId === entry.placeId);
    if (store) group.rows.push({ entry, store });
  }
  const total = history.length;

  // 絞り込み・並べ替えは日付ごとに行う。
  const shownGroups = groups
    .map((g) => {
      const kept = filters.apply(g.rows.map((r) => r.store));
      return { ...g, rows: kept.map((s) => g.rows.find((r) => r.store === s)!) };
    })
    // 絞り込みで0件になった日は隠す(閉じている日は中身が分からないので残す)。
    .filter((g) => g.rows.length > 0 || !filters.narrowing || !openDays.has(g.label));
  const shown = shownGroups.reduce((n, g) => n + g.rows.length, 0);

  function toggleSelecting() {
    setSelecting((s) => !s);
    setPicked(new Set());
  }

  function toggleRowPicked(placeId: string) {
    if (myFavoritePlaceIds.has(placeId)) return;
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) next.delete(placeId);
      else next.add(placeId);
      return next;
    });
  }

  function handleConfirm() {
    if (picked.size === 0) return;
    onBulkAdd(Array.from(picked));
    setSelecting(false);
    setPicked(new Set());
  }

  if (total === 0) {
    return (
      <p className="flex-1 pt-10 text-center text-sm text-text-secondary">
        {loading ? "読み込んでいます…" : "まだありません。スワイプで右にした店がここに並びます"}
      </p>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex shrink-0 flex-col gap-2 px-5 pb-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-text-secondary">見比べて、気になる店をリストへ</p>
          <button
            type="button"
            onClick={toggleSelecting}
            className={`flex h-9 shrink-0 items-center rounded-[18px] px-3.5 text-xs font-bold ${
              selecting
                ? "border border-text-primary bg-text-primary text-app"
                : "border border-[rgba(26,24,19,0.12)] bg-white text-text-primary"
            }`}
          >
            {selecting ? "やめる" : "選んで追加"}
          </button>
        </div>
        <StoreFilterBar filters={filters} shown={shown} total={total} />
      </div>

      <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-5">
        {!groups.some((g) => g.label === TODAY) && (
          <p className="text-center text-xs text-text-tertiary">今日はまだいいねしていません</p>
        )}
        {shownGroups.length === 0 ? (
          <NoMatchingStores onReset={filters.reset} />
        ) : (
          shownGroups.map((group) => {
            const open = openDays.has(group.label);
            return (
              <section key={group.label} className="flex flex-col gap-2.5">
                <DayHeader
                  label={group.label}
                  date={group.date}
                  count={open && filters.narrowing ? group.rows.length : group.entryCount}
                  open={open}
                  onToggle={() => onToggleDay(group.label)}
                />
                {open && group.rows.length === 0 && loading && (
                  <p className="text-center text-xs text-text-tertiary">読み込んでいます…</p>
                )}
                {open && (
                  <ul className="flex flex-col gap-3">
                    {group.rows.map(({ entry, store }) => {
                      const alreadyMine = myFavoritePlaceIds.has(store.placeId);
                      const isPicked = picked.has(store.placeId);
                      const status = filters.statusOf(store);
                      const look = OPEN_STATUS_LOOK[status];
                      return (
                        <li
                          key={store.placeId}
                          role={selecting ? "button" : undefined}
                          tabIndex={selecting ? 0 : undefined}
                          onClick={selecting ? () => toggleRowPicked(store.placeId) : undefined}
                          className="flex flex-col gap-2 rounded-[20px] border p-3"
                          style={{
                            backgroundColor: look.background,
                            borderColor: isPicked ? "var(--accent)" : look.border,
                            cursor: selecting && !alreadyMine ? "pointer" : undefined,
                          }}
                        >
                          <StoreDetailRow
                            store={store}
                            status={status}
                            onOpenPhoto={() => setViewing(store)}
                            dimmed={selecting && alreadyMine}
                            badge={
                              entry.count > 1 && (
                                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-text-primary">
                                  {entry.count}回
                                </span>
                              )
                            }
                            leading={
                              selecting && (
                                <span
                                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
                                  style={
                                    alreadyMine
                                      ? { backgroundColor: "#F1EEE7" }
                                      : isPicked
                                        ? { backgroundColor: "var(--accent)", color: "#fff" }
                                        : {
                                            border: "1.5px solid rgba(26,24,19,0.2)",
                                            backgroundColor: "#fff",
                                          }
                                  }
                                >
                                  {alreadyMine ? (
                                    <span className="text-[9px] font-bold text-text-tertiary">
                                      済
                                    </span>
                                  ) : isPicked ? (
                                    "✓"
                                  ) : null}
                                </span>
                              )
                            }
                            actions={
                              !selecting && (
                                <>
                                  <DirectionsLink store={store} />
                                  <button
                                    type="button"
                                    onClick={() => onToggleMine(store.placeId)}
                                    aria-pressed={alreadyMine}
                                    className={`h-11 min-w-[72px] rounded-[22px] px-3 text-[11px] font-bold ${
                                      alreadyMine
                                        ? "bg-tab-active text-[#8A8474]"
                                        : "border bg-white text-[#8F5E10]"
                                    }`}
                                    style={
                                      !alreadyMine ? { borderColor: "var(--accent)" } : undefined
                                    }
                                  >
                                    {alreadyMine ? "リスト済み" : "＋ リスト"}
                                  </button>
                                </>
                              )
                            }
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })
        )}
      </div>

      {selecting && (
        <div className="shrink-0 border-t border-card-border bg-app px-5 py-3">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={picked.size === 0}
            className={`h-[52px] w-full rounded-[26px] text-sm font-bold ${
              picked.size > 0 ? "bg-accent text-white" : "bg-tab-active text-text-tertiary"
            }`}
          >
            {picked.size > 0 ? `${picked.size}件をリストに追加` : "店を選んでください"}
          </button>
        </div>
      )}
      {viewing && <PhotoViewer store={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}
