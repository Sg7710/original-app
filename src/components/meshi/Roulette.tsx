"use client";

import { useEffect, useRef, useState } from "react";
import type { Store } from "@/types/store";
import type { OpenStatus } from "@/lib/meshi/open-status";
import { useAccount } from "@/hooks/useAccount";
import { directionsUrl } from "@/lib/meshi/derived";
import { TravelTime } from "./TravelTime";
import { PriceLabel } from "./PriceLabel";
import { burstConfetti, celebrateVibrate } from "@/lib/meshi/confetti";

export interface RouletteDay {
  label: string;
  /** その日にリストにある店の数(まだ取り直していない店も含む) */
  entryCount: number;
  /** 取り直し済みの店 */
  stores: Store[];
  /** その日の店を取り直すよう、もう頼んであるか(リストでその日付が開いているか) */
  requested: boolean;
}

interface RouletteProps {
  days: RouletteDay[];
  statusOf: (store: Store) => OpenStatus;
  /** まだ取り直していない日を選んだときに、その日の店を取りに行く(開くだけで閉じない) */
  onNeedDay: (label: string) => void;
  loading: boolean;
  onClose: () => void;
}

/** 1枚の写真の高さ(px)。リールはこの高さで並ぶ。 */
const ITEM_H = 168;
/** 止まるまでに流れる周回数。多いほど勢いよく回って見える。 */
const LAPS = 10;
// 長めに回して、最後はゆっくり止める(どこで止まるかドキドキさせる)。
const SPIN_MS = 6000;

function canGo(status: OpenStatus) {
  return status === "open" || status === "soon";
}

/**
 * 「リスト」から1軒をルーレットで決める画面。日付を選んで「回す」と、今行ける店の写真が
 * スロットのように流れて止まる。止まったら紙吹雪と振動(対応端末のみ)で知らせ、経路を出す。
 * 写真はリストで表示済みの物を使うので、写真代は増えない。
 */
export function Roulette({ days, statusOf, onNeedDay, loading, onClose }: RouletteProps) {
  const [day, setDay] = useState(days[0]?.label ?? "");
  const [phase, setPhase] = useState<"ready" | "spinning" | "done">("ready");
  const [reel, setReel] = useState<Store[]>([]);
  const [offset, setOffset] = useState(0);
  const [winner, setWinner] = useState<Store | null>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const { travelMode } = useAccount().settings;

  const selected = days.find((d) => d.label === day);
  const candidates = (selected?.stores ?? []).filter((s) => canGo(statusOf(s)));
  const notRequested = !!selected && !selected.requested;
  const stillLoading =
    notRequested || (loading && !!selected && selected.stores.length < selected.entryCount);

  // まだ取り直していない日を選んだら、その日の店を取りに行く。
  useEffect(() => {
    if (notRequested) onNeedDay(day);
  }, [day, notRequested, onNeedDay]);

  const reduceMotion =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function spin() {
    if (candidates.length === 0 || phase === "spinning") return;
    const pick = Math.floor(Math.random() * candidates.length);
    // 候補を何周も並べたリールを作り、最後の周の当たりの位置で止める。
    const laps = candidates.length === 1 ? LAPS * 2 : LAPS;
    const strip = Array.from({ length: laps + 1 }, () => candidates).flat();
    const target = laps * candidates.length + pick;
    setReel(strip);
    setWinner(candidates[pick]);
    setOffset(0);
    setPhase("spinning");
    // 1フレーム待ってから動かす(最初の位置を描いてからでないと動きが付かない)
    requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target * ITEM_H)));
    if (reduceMotion) finish();
  }

  function finish() {
    setPhase("done");
    celebrateVibrate();
    if (!reduceMotion && confettiRef.current) burstConfetti(confettiRef.current);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="ルーレットで決める"
      className="absolute inset-0 z-[90] flex flex-col bg-[#1A1813] text-white"
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-5">
        <h2 className="text-lg font-black">ルーレットで決める</h2>
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full bg-white/12 px-4 text-sm font-bold"
        >
          ✕ 閉じる
        </button>
      </div>

      {/* どの日のリストから決めるか */}
      <div
        className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-3"
        role="radiogroup"
        aria-label="日付"
      >
        {days.map((d) => {
          const active = d.label === day;
          return (
            <button
              key={d.label}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={phase === "spinning"}
              onClick={() => {
                setDay(d.label);
                setPhase("ready");
                setWinner(null);
              }}
              className={`h-9 shrink-0 rounded-full px-4 text-xs font-bold ${
                active ? "bg-accent text-text-primary" : "bg-white/10 text-white/80"
              }`}
            >
              {d.label}・{d.entryCount}件
            </button>
          );
        })}
      </div>

      {/* リール: 真ん中の枠で止まる */}
      <div
        className="relative mx-5 shrink-0 overflow-hidden rounded-[24px] bg-black/40"
        style={{ height: ITEM_H * 1.9 }}
      >
        {phase === "ready" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            {stillLoading && candidates.length === 0 ? (
              <p className="text-sm text-white/70">お店を読み込んでいます…</p>
            ) : candidates.length === 0 ? (
              <>
                <p className="text-sm font-bold">この日は、今行けるお店がありません</p>
                <p className="text-xs text-white/60">
                  営業時間外のお店はルーレットに入れていません
                </p>
              </>
            ) : (
              <>
                <p className="text-4xl" aria-hidden>
                  🎰
                </p>
                <p className="text-sm font-bold">今行ける{candidates.length}軒から決めます</p>
              </>
            )}
          </div>
        ) : (
          <div
            className="absolute inset-x-0"
            style={{
              top: (ITEM_H * 1.9 - ITEM_H) / 2,
              transform: `translateY(${-offset}px)`,
              transition:
                phase === "spinning" && offset > 0 && !reduceMotion
                  ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.65, 0.04, 1)`
                  : "none",
            }}
            onTransitionEnd={() => phase === "spinning" && finish()}
          >
            {reel.map((s, i) => (
              <div
                key={i}
                className="flex items-center justify-center px-3"
                style={{ height: ITEM_H }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.photoUrl}
                  alt=""
                  className="h-[150px] w-full rounded-[18px] object-cover"
                  draggable={false}
                />
              </div>
            ))}
          </div>
        )}
        {/* 上下を暗くして、真ん中の1枚に目が行くようにする */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-[#1A1813] to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-[#1A1813] to-transparent" />
        <div
          className={`pointer-events-none absolute inset-x-2 rounded-[22px] border-4 transition-colors ${
            phase === "done" ? "border-accent" : "border-white/25"
          }`}
          style={{ top: (ITEM_H * 1.9 - ITEM_H) / 2 + 4, height: ITEM_H - 8 }}
        />
      </div>

      {/* 紙吹雪は画面全体に舞わせる(写真の枠で切れないように) */}
      <div
        ref={confettiRef}
        className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
        aria-hidden="true"
      />

      {/* 結果 */}
      <div
        className="flex flex-1 flex-col items-center justify-start gap-2 px-6 pt-5 text-center"
        aria-live="polite"
      >
        {phase === "done" && winner && (
          <>
            <p className="text-xs font-bold text-accent">ここに決まり！</p>
            <p className="text-2xl font-black leading-snug">{winner.name}</p>
            <p className="font-mono text-sm text-white/80">
              <TravelTime store={winner} />
              <span className="mx-2 text-white/40">/</span>
              <PriceLabel store={winner} />
            </p>
          </>
        )}
        {phase === "spinning" && <p className="text-sm text-white/70">まわっています…</p>}
      </div>

      <div className="flex shrink-0 flex-col gap-3 px-5 pb-8">
        {phase === "done" && winner ? (
          <a
            href={directionsUrl(winner, travelMode)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-14 items-center justify-center gap-2 rounded-full bg-[#1A73E8] text-base font-black text-white"
          >
            経路で行く
            <span aria-hidden>↗</span>
          </a>
        ) : (
          <button
            type="button"
            onClick={spin}
            disabled={candidates.length === 0 || phase === "spinning"}
            className="h-14 rounded-full bg-accent text-base font-black text-text-primary disabled:opacity-40"
          >
            {phase === "spinning" ? "…" : "回す"}
          </button>
        )}
      </div>
    </div>
  );
}
