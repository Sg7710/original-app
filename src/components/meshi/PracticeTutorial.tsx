"use client";

import { useRef, useState } from "react";
import { PRACTICE_LIKE, PRACTICE_PASS, PRACTICE_PHOTOS } from "@/lib/meshi/practice";
import { SwipeTab } from "./SwipeTab";
import { OPEN_STATUS_LOOK, StoreDetailRow } from "./StoreDetailRow";
import { DoubleThumbsIcon } from "./DoubleThumbsIcon";

/**
 * 使い方の練習(チュートリアル)。本物のお店は使わず、練習用のカードと練習用の
 * 食べたいリストで、実際に指を動かしながら覚えてもらう。ここでのスワイプは本物の
 * 「食べたい」やリストには入らない。いつでも「スキップ」で終われる。
 *
 * 1. 右にスワイプ(食べたい) 2. 左にスワイプ(パス) 3. 写真をタップしてめくる
 * 4. 「食べたい」から「＋ リスト」 5. ルーレットとみんなでスワイプの紹介
 */
const STEPS = 5;
const CARDS = [PRACTICE_LIKE, PRACTICE_PASS, PRACTICE_PHOTOS];

const GUIDE: Record<number, string> = {
  1: "行きたいお店は、カードを右にスワイプ👉",
  2: "気分じゃなければ、左にスワイプでパス👈",
  3: "写真の右側をタップすると、次の写真が見られます",
  4: "右にスワイプした店は「食べたい」に集まります。見比べて、行くと決めたら「＋ リスト」",
  5: "リストから1軒に決めるなら「ルーレット」、友達と決めるなら「みんなでスワイプ」",
};

export function PracticeTutorial({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(1);
  /** 違う向きにスワイプしたとき、カードを戻すために作り直す回数 */
  const [attempt, setAttempt] = useState(0);
  const [hint, setHint] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(false);
  const lastSwipe = useRef<"like" | "pass" | null>(null);

  // 作り直すたびに place ID を変えて、飛んでいったカードを新しく出し直す
  const cards = CARDS.map((s) => ({ ...s, placeId: `${s.placeId}-${attempt}` }));

  function afterSwipe() {
    const swiped = lastSwipe.current;
    lastSwipe.current = null;
    if (step === 1 && swiped === "like") {
      setHint(null);
      setStep(2);
    } else if (step === 2 && swiped === "pass") {
      setHint(null);
      setStep(3);
    } else {
      setHint(
        step === 1
          ? "おしい！今度は右にスワイプしてみよう"
          : step === 2
            ? "おしい！今度は左にスワイプしてみよう"
            : "スワイプではなく、写真の右側をタップしてみよう",
      );
      setAttempt((a) => a + 1);
    }
  }

  function photoFlipped() {
    if (step !== 3 || flipped) return;
    setFlipped(true);
    setHint(null);
    window.setTimeout(() => setStep(4), 1200);
  }

  const guide = step === 3 && flipped ? "いいね！写真は最大5枚までめくれます" : GUIDE[step];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="使い方の練習"
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* 上: 何ステップ目か と スキップ */}
      <div className="flex shrink-0 items-center justify-between px-5 pb-2 pt-4">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-black text-text-primary">
            練習
          </span>
          <div className="flex gap-1" aria-label={`${STEPS}ステップ中${step}ステップ目`}>
            {Array.from({ length: STEPS }, (_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i + 1 === step
                    ? "w-5 bg-text-primary"
                    : i + 1 < step
                      ? "w-1.5 bg-text-primary/60"
                      : "w-1.5 bg-text-primary/15"
                }`}
              />
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="h-9 rounded-full px-3 text-xs font-bold text-text-secondary"
        >
          スキップ
        </button>
      </div>

      {/* 吹き出し */}
      <div className="shrink-0 px-5 pb-1" aria-live="polite">
        <p className="rounded-[18px] bg-text-primary px-4 py-3 text-sm font-bold leading-relaxed text-white">
          {guide}
        </p>
        {hint && <p className="mt-1.5 text-center text-xs font-bold text-[#D8452F]">{hint}</p>}
      </div>

      {step <= 3 && (
        <SwipeTab
          stores={cards}
          idx={step - 1}
          onLike={() => (lastSwipe.current = "like")}
          onPass={() => (lastSwipe.current = "pass")}
          onAdvance={afterSwipe}
          onPhotoFlip={photoFlipped}
        />
      )}

      {step >= 4 && <PracticeList step={step} onAddToList={() => setStep(5)} onDone={onDone} />}
    </div>
  );
}

/** 練習用の食べたいリスト(4: 「食べたい」タブ / 5: 「リスト」タブ)。 */
function PracticeList({
  step,
  onAddToList,
  onDone,
}: {
  step: number;
  onAddToList: () => void;
  onDone: () => void;
}) {
  const inList = step === 5;
  const look = OPEN_STATUS_LOOK.open;
  const fakeRoute = (
    <span className="flex h-11 min-w-[64px] items-center justify-center rounded-[22px] bg-[#E6F0FC] px-3 text-[11px] font-bold text-[#1A73E8]">
      経路
    </span>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden pt-3">
      <div className="flex shrink-0 flex-col gap-3 px-5 pb-3">
        <h2 className="text-2xl font-black text-text-primary">食べたいリスト</h2>
        <div className="flex gap-1 rounded-[22px] bg-tab-active p-1" aria-hidden>
          {[
            { label: "食べたい", count: inList ? 0 : 1, active: !inList },
            { label: "リスト", count: inList ? 1 : 0, active: inList },
          ].map((seg) => (
            <span
              key={seg.label}
              className={`flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[18px] text-[13px] font-bold ${
                seg.active
                  ? "bg-white text-text-primary shadow-[0_2px_8px_rgba(26,24,19,0.08)]"
                  : "text-[#8A8474]"
              }`}
            >
              {seg.label}
              <span className="font-mono text-[11px] opacity-70">{seg.count}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <div
          className="flex flex-col gap-2 rounded-[20px] border p-3"
          style={{ backgroundColor: look.background, borderColor: look.border }}
        >
          <StoreDetailRow
            store={PRACTICE_LIKE}
            status="open"
            onOpenPhoto={() => {}}
            actions={
              <>
                {fakeRoute}
                {inList ? (
                  <span className="flex h-11 min-w-[64px] items-center justify-center rounded-[22px] border border-[rgba(26,24,19,0.12)] px-3 text-[11px] font-bold text-[#8A8474]">
                    はずす
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={onAddToList}
                    className="h-11 min-w-[72px] animate-pulse rounded-[22px] border-2 border-accent bg-white px-3 text-[11px] font-black text-[#8F5E10] ring-4 ring-accent/40 motion-reduce:animate-none"
                  >
                    ＋ リスト
                  </button>
                )}
              </>
            }
          />
        </div>
      </div>

      {inList && (
        <div className="flex shrink-0 flex-col gap-3 border-t border-card-border bg-app px-5 py-3">
          <div className="flex gap-2.5" aria-hidden>
            <span className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[26px] bg-text-primary text-sm font-black text-white ring-4 ring-accent/50">
              <span>🎰</span>
              ルーレット
            </span>
            <span className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-[26px] bg-accent text-sm font-black text-text-primary ring-4 ring-accent/50">
              <DoubleThumbsIcon gapColor="var(--accent)" />
              みんなでスワイプ
            </span>
          </div>
          <button
            type="button"
            onClick={onDone}
            className="h-[52px] rounded-[26px] border border-card-border bg-white text-sm font-black text-text-primary"
          >
            はじめる
          </button>
        </div>
      )}
    </div>
  );
}
