"use client";

import type { LocationStatus } from "@/hooks/useLocation";
import type { MaxPriceTier } from "@/hooks/useAccount";
import { priceLimitLabel, radiusLabel, SlidersIcon } from "./SearchConditions";

interface HeaderProps {
  locationStatus: LocationStatus;
  /** The radius actually being searched (may be widened just for this session). */
  radiusM: number;
  maxPriceTier: MaxPriceTier;
  onOpenConditions: () => void;
}

const STATUS_DOT: Record<LocationStatus, string> = {
  idle: "bg-text-tertiary",
  requesting: "bg-[#C8811A]",
  granted: "bg-[#2E9E63]",
  denied: "bg-[#D8452F]",
  error: "bg-[#D8452F]",
};

const STATUS_LABEL: Record<LocationStatus, string> = {
  idle: "現在地を準備しています",
  requesting: "現在地を取得しています…",
  granted: "現在地を取得しました",
  denied: "現在地の許可が必要です",
  error: "現在地を取得できませんでした",
};

export function Header({ locationStatus, radiusM, maxPriceTier, onOpenConditions }: HeaderProps) {
  const conditions = `${radiusLabel(radiusM)} · ${priceLimitLabel(maxPriceTier)}`;
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-5 pt-5">
      <button
        type="button"
        onClick={onOpenConditions}
        aria-label={`探す条件を変える（いまは ${conditions}）`}
        className="flex h-11 min-w-0 items-center gap-1.5 rounded-full border border-card-border bg-white px-3.5 text-xs font-bold text-text-primary shadow-[0_2px_8px_rgba(26,24,19,0.06)]"
      >
        <SlidersIcon />
        <span className="truncate font-mono">{conditions}</span>
      </button>
      <p className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold text-text-secondary">
        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[locationStatus]}`} />
        <span className="truncate">{STATUS_LABEL[locationStatus]}</span>
      </p>
    </div>
  );
}
