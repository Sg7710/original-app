"use client";

import { useEffect, useRef, useState } from "react";
import type { Store } from "@/types/store";
import { MAX_PHOTOS } from "./StoreCard";

interface PhotoViewerProps {
  store: Pick<Store, "name" | "photos" | "photoUrl" | "photoAttribution">;
  onClose: () => void;
}

/**
 * お店の写真を画面いっぱいでじっくり見る画面。スワイプのカードと同じく最大5枚まで、
 * めくったときに1枚ずつ取る(写真は1枚ごとに料金がかかるため)。写真は切らずに全体を出す。
 */
export function PhotoViewer({ store, onClose }: PhotoViewerProps) {
  const photos = store.photos.length
    ? store.photos.slice(0, MAX_PHOTOS)
    : [{ url: store.photoUrl, attribution: store.photoAttribution }];
  // wanted = 見たい写真、shown = 読み込みが終わって表示中の写真(読み込み中は前の写真を出したまま)。
  const [wanted, setWanted] = useState(0);
  const [shown, setShown] = useState(0);
  const loading = wanted !== shown;
  const closeRef = useRef<HTMLButtonElement>(null);

  function flip(step: 1 | -1) {
    setWanted((i) => Math.min(Math.max(i + step, 0), photos.length - 1));
  }

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") flip(1);
      else if (e.key === "ArrowLeft") flip(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // flip only uses the setter and photos.length, which don't change while open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${store.name}の写真`}
      className="fixed inset-0 z-50 flex justify-center bg-black"
    >
      <div className="flex h-full w-full max-w-[402px] flex-col">
        <div className="flex shrink-0 flex-col gap-2 px-4 pb-2 pt-3">
          <div className="flex items-center justify-between">
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              className="h-11 rounded-full bg-white/15 px-4 text-sm font-bold text-white"
            >
              ✕ 閉じる
            </button>
            {photos.length > 1 && (
              <span className="font-mono text-sm text-white/80">
                {wanted + 1} / {photos.length}
              </span>
            )}
          </div>
          {photos.length > 1 && (
            <div className="flex gap-1.5" aria-hidden="true">
              {photos.map((p, i) => (
                <span
                  key={p.url}
                  className={`h-[4px] flex-1 rounded-full ${i === wanted ? "bg-white" : "bg-white/35"}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="relative min-h-0 flex-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[shown].url}
            alt={store.name}
            className="absolute inset-0 h-full w-full object-contain"
            draggable={false}
          />
          {loading && (
            <>
              {/* 見えないところで次の写真を読み込み、終わったら差し替える */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photos[wanted].url}
                src={photos[wanted].url}
                alt=""
                className="hidden"
                onLoad={() => setShown(wanted)}
                onError={() => setWanted(shown)}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <span
                  role="status"
                  aria-label="写真を読み込み中"
                  className="h-10 w-10 animate-spin rounded-full border-4 border-white/30 border-t-white motion-reduce:animate-none"
                />
              </div>
            </>
          )}
          {/* 左半分タップで前、右半分タップで次の写真(スワイプのカードと同じ操作) */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                aria-label="前の写真"
                disabled={wanted === 0}
                onClick={() => flip(-1)}
                className="absolute inset-y-0 left-0 w-1/2"
              />
              <button
                type="button"
                aria-label="次の写真"
                disabled={wanted === photos.length - 1}
                onClick={() => flip(1)}
                className="absolute inset-y-0 right-0 w-1/2"
              />
            </>
          )}
        </div>

        <div className="shrink-0 px-4 pb-8 pt-3">
          <p className="text-base font-bold leading-snug text-white">{store.name}</p>
          <p className="mt-1 text-[11px] text-white/60">写真: {photos[shown].attribution}</p>
        </div>
      </div>
    </div>
  );
}
