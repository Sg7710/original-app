"use client";

import { useMemo, useRef, useState } from "react";
import type { Store } from "@/types/store";
import { StoreCard, type StoreCardHandle } from "./StoreCard";

interface SwipeTabProps {
  stores: Store[];
  idx: number;
  isRelapse?: boolean;
  onAdvance: () => void;
  onLike: (placeId: string) => void;
  onPass: (placeId: string) => void;
}

export function SwipeTab({ stores, idx, isRelapse = false, onAdvance, onLike, onPass }: SwipeTabProps) {
  const topRef = useRef<StoreCardHandle>(null);
  const [announcement, setAnnouncement] = useState("");
  const stack = useMemo(() => stores.slice(idx, idx + 3), [stores, idx]);
  const total = stores.length;
  const current = Math.min(idx + 1, total);
  const topStore = stack[0];

  function handleCommit(direction: "like" | "pass") {
    if (!topStore) return;
    if (direction === "like") {
      onLike(topStore.placeId);
    } else {
      onPass(topStore.placeId);
    }
    setAnnouncement(
      direction === "like"
        ? `${topStore.name}を食べたいに追加しました`
        : `${topStore.name}をパスしました`,
    );
  }

  const liveRegion = (
    <div aria-live="polite" className="sr-only">
      {announcement}
    </div>
  );

  if (stack.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        {liveRegion}
        <p className="text-sm text-text-secondary">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-5 pt-4">
      {liveRegion}
      <div className="relative flex-1 overflow-hidden">
        {stack.map((store, i) => (
          <StoreCard
            key={store.placeId}
            ref={i === 0 ? topRef : undefined}
            store={store}
            position={i}
            isRelapse={isRelapse}
            onCommit={handleCommit}
            onAdvance={onAdvance}
          />
        ))}
      </div>
      <div className="flex items-center justify-center gap-4 py-5">
        <button
          type="button"
          aria-label="パスする"
          data-onboarding-target="pass"
          onClick={() => topRef.current?.commit("pass")}
          className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-full border border-card-border bg-white text-base font-bold text-text-secondary shadow-card"
        >
          ❌ パス
        </button>
        <button
          type="button"
          aria-label="食べたいリストに追加"
          data-onboarding-target="like"
          onClick={() => topRef.current?.commit("like")}
          className="flex h-[62px] flex-1 items-center justify-center gap-2 rounded-full bg-accent text-base font-bold text-text-primary shadow-card"
        >
          👍 食べたい
        </button>
      </div>
      <p className="pb-4 text-center font-mono text-xs text-text-tertiary">
        {current}/{total}
      </p>
    </div>
  );
}
