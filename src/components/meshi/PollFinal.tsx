"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Store } from "@/types/store";
import type { Poll } from "@/lib/meshi/polls";
import { useAccount } from "@/hooks/useAccount";
import { directionsUrl } from "@/lib/meshi/derived";
import { burstConfetti, celebrateVibrate, prefersReducedMotion } from "@/lib/meshi/confetti";

const ITEM_H = 150;
const LAPS = 8;
const SPIN_MS = 5000;

/**
 * 終わった投票の「ここに決まり！」。票で決まったらすぐ紙吹雪、並んでルーレットで決まったら
 * 並んだ店の写真が流れて、サーバーで決まった店で止まる(全員に同じ結果)。
 */
export function WinnerReveal({ poll, stores }: { poll: Poll; stores: Store[] }) {
  const { travelMode } = useAccount().settings;
  const winner = stores.find((s) => s.placeId === poll.winnerPlaceId) ?? null;
  const reelStores =
    poll.decidedBy === "roulette"
      ? stores.filter((s) => poll.tiedPlaceIds?.includes(s.placeId))
      : [];
  const spins = reelStores.length > 1 && !prefersReducedMotion();
  const [revealed, setRevealed] = useState(!spins);
  const [offset, setOffset] = useState(0);
  const confettiRef = useRef<HTMLDivElement>(null);

  const winIndex = winner ? reelStores.findIndex((s) => s.placeId === winner.placeId) : 0;
  const strip = spins ? Array.from({ length: LAPS + 1 }, () => reelStores).flat() : [];
  const target = LAPS * reelStores.length + Math.max(winIndex, 0);

  useEffect(() => {
    if (!spins) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(target * ITEM_H)));
    return () => cancelAnimationFrame(id);
  }, [spins, target]);

  useEffect(() => {
    if (!revealed || !winner) return;
    celebrateVibrate();
    if (confettiRef.current && !prefersReducedMotion()) burstConfetti(confettiRef.current, 30);
  }, [revealed, winner]);

  if (!winner) return null;

  return (
    <div className="relative flex flex-col items-center gap-3 px-5 pb-4 text-center">
      <div ref={confettiRef} className="pointer-events-none absolute inset-0 z-10" aria-hidden />
      {poll.decidedBy === "roulette" && (
        <p className="text-xs font-bold text-text-secondary">
          {reelStores.length}軒が同じ票数だったので、ルーレットで決めました
        </p>
      )}
      <div
        className="relative w-full overflow-hidden rounded-[24px] bg-[#1A1813]"
        style={{ height: spins && !revealed ? ITEM_H * 1.6 : undefined }}
      >
        {spins && !revealed ? (
          <>
            <div
              className="absolute inset-x-0"
              style={{
                top: (ITEM_H * 1.6 - ITEM_H) / 2,
                transform: `translateY(${-offset}px)`,
                transition:
                  offset > 0 ? `transform ${SPIN_MS}ms cubic-bezier(0.1, 0.65, 0.04, 1)` : "none",
              }}
              onTransitionEnd={() => setRevealed(true)}
            >
              {strip.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-center px-3"
                  style={{ height: ITEM_H }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={s.photoUrl}
                    alt=""
                    className="h-[134px] w-full rounded-[16px] object-cover"
                  />
                </div>
              ))}
            </div>
            <div
              className="pointer-events-none absolute inset-x-2 rounded-[20px] border-4 border-white/30"
              style={{ top: (ITEM_H * 1.6 - ITEM_H) / 2 + 4, height: ITEM_H - 8 }}
            />
          </>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={winner.photoUrl} alt={winner.name} className="h-[200px] w-full object-cover" />
        )}
      </div>
      <div aria-live="polite" className="flex flex-col items-center gap-1">
        {revealed ? (
          <>
            <p className="text-xs font-black text-[#E8641E]">ここに決まり！</p>
            <p className="text-2xl font-black leading-snug text-text-primary">{winner.name}</p>
            <p className="text-xs text-text-secondary">
              {winner.genre}
              {winner.price ? `・${winner.price}` : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-text-secondary">ルーレットを回しています…</p>
        )}
      </div>
      {revealed && (
        <a
          href={directionsUrl(winner, travelMode)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-14 w-full items-center justify-center gap-2 rounded-full bg-[#1A73E8] text-base font-black text-white"
        >
          経路で行く
          <span aria-hidden>↗</span>
        </a>
      )}
    </div>
  );
}

/** 1位が並んだとき。作った人は決め方を選び、ほかの人は決まるのを待つ。 */
export function TieChooser({
  poll,
  stores,
  busy,
  error,
  onChoose,
}: {
  poll: Poll;
  stores: Store[];
  busy: boolean;
  error: boolean;
  onChoose: (method: "roulette" | "runoff") => void;
}) {
  const tied = stores.filter((s) => poll.tiedPlaceIds?.includes(s.placeId));
  return (
    <div className="flex flex-col gap-3 px-5 pb-4">
      <div className="rounded-[20px] bg-[#FFF6E5] px-4 py-3 text-center">
        <p className="text-sm font-black text-text-primary">
          {tied.length}軒が同じ票数で並びました
        </p>
        <p className="mt-1 text-xs text-text-secondary">{tied.map((s) => s.name).join("・")}</p>
      </div>
      {poll.isOwner ? (
        <>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose("roulette")}
            className="h-[52px] rounded-full bg-text-primary text-sm font-black text-white disabled:opacity-40"
          >
            🎰 ルーレットで決める
          </button>
          {!poll.parentPollId && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose("runoff")}
              className="h-[52px] rounded-full bg-accent text-sm font-black text-text-primary disabled:opacity-40"
            >
              🗳 この{tied.length}軒で決選投票する
            </button>
          )}
          {error && (
            <p role="alert" className="text-center text-xs font-bold text-[#D8452F]">
              うまくいきませんでした。もう一度押してください。
            </p>
          )}
        </>
      ) : (
        <p className="text-center text-sm text-text-secondary" aria-live="polite">
          作った人が、いま決め方を選んでいます…
        </p>
      )}
    </div>
  );
}

export function RunoffLink({ runoffPollId }: { runoffPollId: string }) {
  return (
    <div className="px-5 pb-4">
      <Link
        href={`/poll/${runoffPollId}`}
        className="flex h-[56px] items-center justify-center gap-2 rounded-full bg-accent text-base font-black text-text-primary"
      >
        🗳 決選投票へ →
      </Link>
    </div>
  );
}
