"use client";

import type { Store } from "@/types/store";
import { directionsUrl } from "@/lib/meshi/derived";
import { TravelTime } from "./TravelTime";
import { useAccount } from "@/hooks/useAccount";
import type { OpenStatus } from "@/lib/meshi/open-status";
import { PriceLabel } from "./PriceLabel";
import { StoreThumb } from "./StoreThumb";

/** Map-pin outline icon, drawn large and faint behind the 経路 label. */
function PinIcon() {
  return (
    <svg
      aria-hidden
      width="34"
      height="34"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.4" />
    </svg>
  );
}

/** Google マップの徒歩経路を開くボタン(APIを使わないリンクなので料金なし)。 */
export function DirectionsLink({ store }: { store: Store }) {
  const { travelMode } = useAccount().settings;
  return (
    <a
      href={directionsUrl(store, travelMode)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      aria-label={`${store.name}までの経路をGoogleマップで見る`}
      className="relative flex h-11 min-w-[64px] items-center justify-center overflow-hidden rounded-[22px] bg-[#E6F0FC] px-3"
    >
      <span className="absolute inset-0 flex items-center justify-center text-[#AECBFA]">
        <PinIcon />
      </span>
      <span className="relative text-[11px] font-bold text-[#1A73E8]">経路</span>
    </a>
  );
}

/** 営業状況ごとの行の色(背景・ふち)とバッジ。 */
export const OPEN_STATUS_LOOK: Record<
  OpenStatus,
  { background: string; border: string; badge: { label: string; className: string } | null }
> = {
  open: {
    background: "#FFFFFF",
    border: "rgba(62,158,104,0.45)",
    badge: { label: "営業中", className: "bg-[#E3F3EA] text-[#2E7D4F]" },
  },
  soon: {
    background: "#FFF8E8",
    border: "rgba(226,179,58,0.45)",
    badge: { label: "まもなく開店", className: "bg-[#FBEFD2] text-[#8F5E10]" },
  },
  unknown: { background: "#FFFFFF", border: "rgba(26,24,19,0.07)", badge: null },
  closed: {
    background: "#F3F1EC",
    border: "rgba(26,24,19,0.07)",
    badge: { label: "営業時間外", className: "bg-[#E6E2DA] text-text-secondary" },
  },
};

interface StoreDetailRowProps {
  store: Store;
  status: OpenStatus;
  /** 写真タップで大きく見る */
  onOpenPhoto: () => void;
  /** 店名の横に出す小さな印(いいねの回数など) */
  badge?: React.ReactNode;
  /** 徒歩の上に出す1行(いいねした時刻など) */
  meta?: React.ReactNode;
  /** 写真の左に出すもの(選んで追加のチェックなど) */
  leading?: React.ReactNode;
  /** 真ん中の列の一番下に足すもの(「○○も食べたい」など) */
  footer?: React.ReactNode;
  /** 右の列のボタン */
  actions?: React.ReactNode;
  dimmed?: boolean;
}

/**
 * お店1件の行。店名は一番上に横幅いっぱい(切れないように)、ジャンルは右上、
 * その下に写真・営業状況・徒歩・値段・公式HPと、右に操作ボタン。
 */
export function StoreDetailRow({
  store,
  status,
  onOpenPhoto,
  badge,
  meta,
  leading,
  footer,
  actions,
  dimmed = false,
}: StoreDetailRowProps) {
  return (
    <>
      <div className="flex items-start gap-2 px-0.5">
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-snug text-text-primary">
          {store.name}
          {badge && <span className="ml-1.5 inline-block align-middle">{badge}</span>}
        </p>
        <span className="mt-0.5 shrink-0 rounded-full bg-tab-active px-2 py-0.5 text-[10px] font-bold text-text-secondary">
          {store.genre}
        </span>
      </div>
      <div className="flex items-center gap-[14px]">
        {leading}
        {/* 営業時間外の店は写真も少し薄くして、営業中の店を目立たせる */}
        <div className={status === "closed" && !dimmed ? "opacity-70" : undefined}>
          <StoreThumb store={store} size={76} radius={17} dimmed={dimmed} onOpen={onOpenPhoto} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {meta}
          {OPEN_STATUS_LOOK[status].badge && (
            <p
              className={`w-fit whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold ${OPEN_STATUS_LOOK[status].badge!.className}`}
            >
              {OPEN_STATUS_LOOK[status].badge!.label}
            </p>
          )}
          <p className="font-mono text-[11px] text-text-secondary">
            <TravelTime store={store} />
          </p>
          <p className="font-mono text-[11px] text-text-secondary">
            <PriceLabel store={store} />
          </p>
          {store.websiteUrl && (
            <a
              href={store.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              aria-label={`${store.name}の公式ホームページを開く`}
              className="flex h-8 w-fit items-center gap-1 rounded-full border border-[rgba(26,24,19,0.12)] px-3 text-[11px] font-bold text-text-secondary"
            >
              公式HP
              <span aria-hidden>↗</span>
            </a>
          )}
          {footer}
        </div>
        {actions && <div className="flex shrink-0 flex-col gap-2">{actions}</div>}
      </div>
    </>
  );
}
