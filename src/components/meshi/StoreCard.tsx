"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Store } from "@/types/store";
import { opensAtText, PRICE_TIER_COLORS, PRICE_UNKNOWN_COLOR } from "@/lib/meshi/derived";
import { TravelTime } from "./TravelTime";

export interface StoreCardHandle {
  commit: (direction: "like" | "pass") => void;
}

interface StoreCardProps {
  store: Store;
  position: number;
  isRelapse?: boolean;
  onCommit?: (direction: "like" | "pass") => void;
  onAdvance?: () => void;
}

const SWIPE_THRESHOLD = 88; // px
const VELOCITY_THRESHOLD = 0.5; // px/ms — a fast short flick commits even under the distance threshold
const FLY_DISTANCE = 520;
const SETTLE_MS = 260;
const HISTORY_SIZE = 3; // velocity is averaged over the last N move samples, not just the last 2 (jitter-prone)
const TAP_SLOP = 8; // px — a press that moves less than this is a tap (flip photo), not a drag
/** 写真は1枚ごとにGoogleの料金がかかるので、めくれるのは5枚まで・めくったときに1枚ずつ取る。 */
export const MAX_PHOTOS = 5;
/**
 * 写真はこの割合までなら端を切って大きく出す(ぼかしのすき間を小さくするため)。
 * それ以上切れる写真は切るのをここで止め、残りのすき間を同じ写真のぼかしで埋める。
 */
const MAX_CROP = 0.12;
/** 写真のふちをぼかしになじませる幅(px)。くっきりした境目を出さないため。 */
const EDGE_FADE_PX = 28;
/** 外枠(価格帯の色)の太さ。 */
const FRAME_PX = 4;
/** 価格が分からない店の枠。白文字だと灰色の上で読みにくいので文字は濃い色にする。 */
const PRICE_UNKNOWN_FRAME = { bg: PRICE_UNKNOWN_COLOR, fg: "#1A1813" };

interface PhotoBox {
  left: number;
  top: number;
  width: number;
  height: number;
  /** 写真が枠より小さく、上下(または左右)にぼかしのすき間があるか */
  gapY: boolean;
  gapX: boolean;
}

/** 枠(areaW×areaH)の中に、縦横比 aspect の写真をどの大きさ・位置で置くか。 */
function fitPhoto(aspect: number, areaW: number, areaH: number): PhotoBox {
  const cover = Math.max(areaW / aspect, areaH); // 枠いっぱい(はみ出た分は切れる)のときの写真の高さ
  const contain = Math.min(areaW / aspect, areaH); // 全体が入る(すき間ができる)ときの写真の高さ
  const height = Math.min(cover, contain / (1 - MAX_CROP));
  const width = height * aspect;
  return {
    left: (areaW - width) / 2,
    top: (areaH - height) / 2,
    width,
    height,
    gapY: height < areaH - 1,
    gapX: width < areaW - 1,
  };
}

function edgeFadeMask(box: PhotoBox): string | undefined {
  const fade = (dir: string) =>
    `linear-gradient(${dir}, transparent, #000 ${EDGE_FADE_PX}px, #000 calc(100% - ${EDGE_FADE_PX}px), transparent)`;
  if (box.gapY && box.gapX) return `${fade("to bottom")}, ${fade("to right")}`;
  if (box.gapY) return fade("to bottom");
  if (box.gapX) return fade("to right");
  return undefined;
}

export const StoreCard = forwardRef<StoreCardHandle, StoreCardProps>(function StoreCard(
  { store, position, isRelapse = false, onCommit, onAdvance },
  ref,
) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [flying, setFlying] = useState<"like" | "pass" | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const dxRef = useRef(0);
  const historyRef = useRef<{ x: number; t: number }[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const photoAreaRef = useRef<HTMLDivElement>(null);

  const photos = store.photos.slice(0, MAX_PHOTOS);
  // wanted = 見たい写真、shown = 読み込みが終わって表示中の写真。
  // 読み込み中は前の写真を出したまま、くるくるを重ねる(真っ白にならないように)。
  const [wantedPhoto, setWantedPhoto] = useState(0);
  const [shownPhoto, setShownPhoto] = useState(0);
  const loadingPhoto = wantedPhoto !== shownPhoto;
  const shown = photos[shownPhoto] ?? {
    url: store.photoUrl,
    attribution: store.photoAttribution,
  };

  // 写真の縦横比(幅÷高さ)と枠の大きさ。両方わかってから写真の置き方を決める(fitPhoto)。
  const [photoAspect, setPhotoAspect] = useState<number | null>(null);
  const [areaSize, setAreaSize] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => {
    const area = photoAreaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setAreaSize({ w: width, h: height });
    });
    observer.observe(area);
    return () => observer.disconnect();
  }, []);
  const photoBox = photoAspect && areaSize ? fitPhoto(photoAspect, areaSize.w, areaSize.h) : null;
  const hasGap = !!photoBox && (photoBox.gapX || photoBox.gapY);
  const mask = photoBox ? edgeFadeMask(photoBox) : undefined;

  const isTop = position === 0;

  // Keyboard users tab/focus onto whichever card is currently on top; when a
  // card becomes the top card (after the previous one is swiped away), move
  // focus to it so arrow-key swiping keeps working without re-tabbing.
  useEffect(() => {
    // preventScroll: 背面カードが下にはみ出している分、枠がスクロールしてカードが上にずれるのを防ぐ。
    if (isTop) cardRef.current?.focus({ preventScroll: true });
  }, [isTop]);

  function commit(direction: "like" | "pass") {
    if (flying) return;
    setDragging(false);
    setFlying(direction);
    setDx(direction === "like" ? FLY_DISTANCE : -FLY_DISTANCE);
    onCommit?.(direction);
    // prefers-reduced-motion: 見た目のtransitionはCSS側で即時化されるが、
    // 次のカードへの切り替え自体も待たせず即座に行う(8.2)。
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.setTimeout(
      () => {
        onAdvance?.();
      },
      reduceMotion ? 0 : SETTLE_MS,
    );
  }

  useImperativeHandle(ref, () => ({ commit }));

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || flying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    startRef.current = { x: e.clientX, y: e.clientY };
    historyRef.current = [{ x: e.clientX, t: e.timeStamp }];
    setDragging(true);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || !startRef.current || flying) return;
    const nextDx = e.clientX - startRef.current.x;
    const nextDy = (e.clientY - startRef.current.y) * 0.4;
    dxRef.current = nextDx;
    setDx(nextDx);
    setDy(nextDy);

    const history = historyRef.current;
    history.push({ x: e.clientX, t: e.timeStamp });
    if (history.length > HISTORY_SIZE) history.shift();
  }

  function releaseVelocity(): number {
    const history = historyRef.current;
    if (history.length < 2) return 0;
    const first = history[0];
    const last = history[history.length - 1];
    const dt = last.t - first.t;
    return dt > 0 ? (last.x - first.x) / dt : 0;
  }

  function flipPhoto(step: 1 | -1) {
    setWantedPhoto((i) => Math.min(Math.max(i + step, 0), photos.length - 1));
  }

  /** 写真の右半分をタップで次、左半分で前の写真。 */
  function handleTap(clientX: number, clientY: number) {
    const rect = photoAreaRef.current?.getBoundingClientRect();
    if (!rect || clientY < rect.top || clientY > rect.bottom) return;
    flipPhoto(clientX - rect.left > rect.width / 2 ? 1 : -1);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || !startRef.current || flying) return;
    const start = startRef.current;
    startRef.current = null;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP) {
      setDragging(false);
      setDx(0);
      setDy(0);
      if (e.type === "pointerup") handleTap(e.clientX, e.clientY);
      return;
    }
    const passedDistance = Math.abs(dxRef.current) > SWIPE_THRESHOLD;
    const passedVelocity = Math.abs(releaseVelocity()) > VELOCITY_THRESHOLD;
    if (passedDistance || passedVelocity) {
      commit(dxRef.current > 0 ? "like" : "pass");
    } else {
      setDragging(false);
      setDx(0);
      setDy(0);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!isTop || flying) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      commit("like");
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      commit("pass");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      flipPhoto(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      flipPhoto(-1);
    }
  }

  const transform = isTop
    ? `translate(${dx}px, ${dy}px) rotate(${dx / 24}deg)`
    : `translateY(${14 * position}px) scale(${1 - 0.04 * position})`;

  const likeOpacity = isTop ? Math.min(Math.max(dx / 100, 0), 1) : 0;
  const passOpacity = isTop ? Math.min(Math.max(-dx / 100, 0), 1) : 0;

  const frame = store.priceTier ? PRICE_TIER_COLORS[store.priceTier] : PRICE_UNKNOWN_FRAME;

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 flex touch-none flex-col overflow-hidden rounded-[24px] shadow-card"
      style={{
        backgroundColor: frame.bg,
        padding: `0 ${FRAME_PX}px ${FRAME_PX}px`,
        transform,
        transformOrigin: "50% 100%",
        transition: isTop && !dragging ? "transform .26s cubic-bezier(.22,.68,.36,1)" : "none",
        opacity: position === 2 ? 0.6 : 1,
        zIndex: 10 - position,
      }}
      tabIndex={isTop ? 0 : -1}
      aria-label={`${store.name}。${store.opensAt ? `${opensAtText(store.opensAt)}。` : ""}右矢印キーで食べたいに追加、左矢印キーでパス${photos.length > 1 ? `、上下の矢印キーで写真を切り替え(${shownPhoto + 1}/${photos.length}枚目)` : ""}`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {/* ヘッダー帯: ジャンル(+再登場)。色は外枠と同じ(価格帯の色) */}
      <div className="flex h-10 shrink-0 items-center gap-2 px-2" style={{ color: frame.fg }}>
        <span className="truncate text-[15px] font-bold">{store.genre}</span>
        {isRelapse && (
          <span className="shrink-0 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-text-primary">
            再登場
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[18px] bg-white">
        <div ref={photoAreaRef} className="relative flex-1 overflow-hidden bg-tab-active">
          {hasGap && (
            // すき間を埋めるぼかし。強めにぼかして暗くし、モザイクっぽさを消す。
            // 同じURLなので写真をもう一度取ることはない(追加料金なし)。
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.url}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full scale-125 object-cover blur-3xl brightness-[0.8] saturate-[0.85]"
              draggable={false}
            />
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={shown.url}
            alt={store.name}
            className={
              photoBox
                ? "absolute max-w-none object-cover"
                : "absolute inset-0 h-full w-full object-cover"
            }
            style={
              photoBox
                ? {
                    left: photoBox.left,
                    top: photoBox.top,
                    width: photoBox.width,
                    height: photoBox.height,
                    maskImage: mask,
                    WebkitMaskImage: mask,
                    maskComposite: "intersect",
                    WebkitMaskComposite: "source-in",
                  }
                : undefined
            }
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth && img.naturalHeight) {
                setPhotoAspect(img.naturalWidth / img.naturalHeight);
              }
            }}
            draggable={false}
          />
          {loadingPhoto && (
            <>
              {/* 見えないところで次の写真を読み込み、終わったら差し替える */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={photos[wantedPhoto].url}
                src={photos[wantedPhoto].url}
                alt=""
                className="hidden"
                onLoad={() => setShownPhoto(wantedPhoto)}
                onError={() => setWantedPhoto(shownPhoto)}
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                <span
                  role="status"
                  aria-label="写真を読み込み中"
                  className="h-9 w-9 animate-spin rounded-full border-4 border-white/40 border-t-white motion-reduce:animate-none"
                />
              </div>
            </>
          )}
          {/* 写真の下側: 開店時刻と撮影者名、その下に何枚目かのバー */}
          <div className="pointer-events-none absolute inset-x-3 bottom-2.5 flex flex-col gap-1.5">
            <div className="flex items-end justify-between gap-2">
              {store.opensAt ? (
                <span className="rounded-[11px] bg-accent px-2.5 py-1 text-xs font-bold text-text-primary">
                  {opensAtText(store.opensAt)}
                </span>
              ) : (
                <span />
              )}
              <span className="truncate text-[10px] text-white/80 [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
                写真: {shown.attribution}
              </span>
            </div>
            {isTop && photos.length > 1 && (
              <div className="flex gap-1.5" aria-hidden="true">
                {photos.map((p, i) => (
                  <span
                    key={p.url}
                    className={`h-[5px] flex-1 rounded-full shadow-[0_0_3px_rgba(0,0,0,0.35)] ${
                      i === wantedPhoto ? "bg-white" : "bg-white/45"
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          {isTop && (
            <>
              <div
                className="pointer-events-none absolute right-6 top-6 rounded-lg border-4 border-accent px-3 py-1 text-lg font-black text-accent"
                style={{ opacity: likeOpacity, transform: "rotate(-12deg)" }}
              >
                👍 食べたい
              </div>
              <div
                className="pointer-events-none absolute left-6 top-6 rounded-lg border-4 border-text-secondary px-3 py-1 text-lg font-black text-text-secondary"
                style={{ opacity: passOpacity, transform: "rotate(12deg)" }}
              >
                ❌ パス
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 px-5 py-4">
          <h2 className="text-[26px] font-black leading-tight text-text-primary">{store.name}</h2>
          <p className="font-mono text-sm text-text-secondary">
            <TravelTime store={store} />
            {store.price ? ` / ${store.price}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
});
