"use client";

import { Avatar } from "./Avatar";

export type FavView = "mine" | "others" | "history";

interface FavListHeaderProps {
  view: FavView;
  onChangeView: (view: FavView) => void;
  userName: string;
  mineCount: number;
  othersCount: number;
  historyCount: number;
  onOpenMenu: () => void;
}

// 食べたい = 右スワイプした店(見比べる場所)、自分 = 行くと決めた店。
const SEGMENTS: { key: FavView; label: string }[] = [
  { key: "history", label: "食べたい" },
  { key: "mine", label: "自分" },
  { key: "others", label: "みんな" },
];

export function FavListHeader({
  view,
  onChangeView,
  userName,
  mineCount,
  othersCount,
  historyCount,
  onOpenMenu,
}: FavListHeaderProps) {
  const counts: Record<FavView, number> = {
    mine: mineCount,
    others: othersCount,
    history: historyCount,
  };

  return (
    <div className="flex shrink-0 flex-col gap-4 px-5 pb-[14px] pt-5">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-black text-text-primary">食べたいリスト</h1>
        <button
          type="button"
          onClick={onOpenMenu}
          className="-m-1.5 flex items-center gap-[7px] p-1.5"
        >
          <Avatar name={userName} color="#1A1813" size={24} className="text-[11px]" />
          <span className="text-xs font-bold text-text-secondary">{userName}</span>
        </button>
      </div>

      <div className="flex gap-1 rounded-[22px] bg-tab-active p-1">
        {SEGMENTS.map((segment) => {
          const active = segment.key === view;
          return (
            <button
              key={segment.key}
              type="button"
              onClick={() => onChangeView(segment.key)}
              className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[13px] font-bold transition-colors ${
                active
                  ? "bg-white text-text-primary shadow-[0_2px_8px_rgba(26,24,19,0.08)]"
                  : "text-[#8A8474]"
              }`}
            >
              <span>{segment.label}</span>
              <span className="font-mono text-[11px] opacity-70">{counts[segment.key]}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
