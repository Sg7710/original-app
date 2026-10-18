"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/types/store";
import type { MaxPriceTier } from "@/hooks/useAccount";
import { PRICE_TIER_COLORS } from "@/lib/meshi/derived";
import { OPEN_STATUS_RANK, openStatus, type OpenStatus } from "@/lib/meshi/open-status";
import { PRICE_OPTIONS } from "./SearchConditions";

/** オン/オフで切り替えるフィルターのボタン。 */
function ToggleChip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-9 rounded-full px-3.5 text-xs font-bold ${
        on
          ? "bg-text-primary text-white"
          : "border border-[rgba(26,24,19,0.12)] bg-white text-text-secondary"
      }`}
    >
      {children}
    </button>
  );
}

/** 営業状況が時間で変わるので、一覧はこの間隔で並び直す(Google には取り直さない)。 */
const STATUS_REFRESH_MS = 60_000;

/**
 * お店一覧の「営業中だけ」「近い順」「予算」と、営業状況での並び順。閉まっている店も
 * 一覧には残し、営業中 → まもなく開店 → 不明 → 営業時間外 の順に並べる。
 */
export function useStoreFilters() {
  const [openOnly, setOpenOnly] = useState(false);
  const [nearFirst, setNearFirst] = useState(false);
  const [maxPriceTier, setMaxPriceTier] = useState<MaxPriceTier>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), STATUS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, []);
  const statusOf = (store: Store): OpenStatus => openStatus(store, now);

  function apply(stores: Store[]): Store[] {
    let result = stores;
    if (openOnly) result = result.filter((s) => statusOf(s) === "open");
    // 価格が分からない店は、スワイプの予算と同じく条件に関係なく残す。
    if (maxPriceTier !== null) {
      result = result.filter((s) => s.priceTier === null || s.priceTier <= maxPriceTier);
    }
    if (nearFirst) {
      // 徒歩時間が分からない店は最後。同じ時間なら元の順のまま。
      result = [...result].sort(
        (a, b) => (a.walkMinutes ?? Infinity) - (b.walkMinutes ?? Infinity),
      );
    }
    // 営業状況の順に並べる(同じ状況の中では、上の並び(近い順など)のまま)。
    return [...result].sort(
      (a, b) => OPEN_STATUS_RANK[statusOf(a)] - OPEN_STATUS_RANK[statusOf(b)],
    );
  }

  return {
    openOnly,
    toggleOpenOnly: () => setOpenOnly((v) => !v),
    nearFirst,
    toggleNearFirst: () => setNearFirst((v) => !v),
    maxPriceTier,
    setMaxPriceTier,
    /** 店が減る条件(並べ替えは含まない)がかかっているか */
    narrowing: openOnly || maxPriceTier !== null,
    apply,
    statusOf,
    reset: () => {
      setOpenOnly(false);
      setMaxPriceTier(null);
    },
  };
}

export type StoreFilters = ReturnType<typeof useStoreFilters>;

export function StoreFilterBar({
  filters,
  shown,
  total,
}: {
  filters: StoreFilters;
  shown: number;
  total: number;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <ToggleChip on={filters.openOnly} onClick={filters.toggleOpenOnly}>
          営業中だけ
        </ToggleChip>
        <ToggleChip on={filters.nearFirst} onClick={filters.toggleNearFirst}>
          近い順
        </ToggleChip>
        {filters.narrowing && (
          <span className="ml-auto font-mono text-[11px] text-text-tertiary">
            {shown}/{total}件
          </span>
        )}
      </div>
      <div
        role="radiogroup"
        aria-label="予算の上限"
        className="flex gap-1 rounded-[22px] bg-tab-active p-1"
      >
        {PRICE_OPTIONS.map((o) => {
          const selected = o.value === filters.maxPriceTier;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => filters.setMaxPriceTier(o.value)}
              className={`flex h-9 flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] ${
                selected ? "bg-white font-bold text-text-primary shadow-sm" : "text-text-secondary"
              }`}
            >
              <span className="flex gap-0.5" aria-hidden>
                {o.dots.map((t) => (
                  <span
                    key={t}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: PRICE_TIER_COLORS[t].bg }}
                  />
                ))}
              </span>
              <span className="text-[10px] leading-none">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function NoMatchingStores({ onReset }: { onReset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 pt-10 text-center">
      <p className="text-sm font-bold text-text-primary">条件に合うお店がありません</p>
      <button
        type="button"
        onClick={onReset}
        className="h-11 rounded-[22px] border border-[rgba(26,24,19,0.12)] bg-white px-5 text-xs font-bold text-text-secondary"
      >
        しぼり込みをやめる
      </button>
    </div>
  );
}
