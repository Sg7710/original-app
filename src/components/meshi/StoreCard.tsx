"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type { Store } from "@/types/store";
import { opensAtText, PRICE_TIER_COLORS, PRICE_UNKNOWN_COLOR } from "@/lib/meshi/derived";
import { TravelTime } from "./TravelTime";
import { openStatus, type OpenStatus } from "@/lib/meshi/open-status";

const OPEN_STATUS_TEXT: Record<OpenStatus, string> = {
  open: "営業中",
  soon: "まもなく開店",
  unknown: "営業時間不明",
  closed: "営業時間外",
};

export interface StoreCardHandle {
  commit: (direction: "like" | "pass") => void;
}

interface StoreCardProps {
  store: Store;
  position: number;
  isRelapse?: boolean;
  onCommit?: (direction: "like" | "pass") => void;
  onAdvance?: () => void;
  /** false: 時間の代わりに営業状況を出す(投票ページなど、見る人の現在地を使わないとき) */
  showTravelTime?: boolean;
  /** 写真をめくったとき(使い方の練習で「タップしてみよう」を見届けるため) */
  onPhotoFlip?: () => void;
}

/** これだけ横に動かしたら確定(カード幅の28%、ただし最大110px)。 */
const SWIPE_THRESHOLD_MAX = 110; // px
const SWIPE_THRESHOLD_RATIO = 0.28;
const VELOCITY_THRESHOLD = 0.45; // px/ms — a fast short flick commits even under the distance threshold
const HISTORY_SIZE = 6; // velocity is averaged over the last N move samples, not just the last 2 (jitter-prone)
/** 離す直前のこの時間の動きだけで「はじいたか」を決める。 */
const VELOCITY_WINDOW_MS = 100;
/** 横に1px動かすごとに何度回すか(つかんだのが上半分なら+、下半分なら-)。 */
const ROTATE_PER_PX = 0.075;
const MAX_ROTATE = 22; // deg
/** 画面の外へ飛んでいく時間と、確定しなかったときにバネで戻る時間。 */
const FLY_MS = 320;
const SNAP_BACK_MS = 480;
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
  { store, position, isRelapse = false, onCommit, onAdvance, showTravelTime = true, onPhotoFlip },
  ref,
) {
  const [flying, setFlying] = useState<"like" | "pass" | null>(null);
  // ドラッグ中の位置は React の状態に入れず、カードの見た目を直接動かす(指に遅れず付いてくるように)。
  // grab = つかんだのがカードの上半分なら 1、下半分なら -1(回る向きが変わる)。
  const startRef = useRef<{ x: number; y: number; grab: 1 | -1 } | null>(null);
  const posRef = useRef({ dx: 0, dy: 0 });
  const historyRef = useRef<{ x: number; y: number; t: number }[]>([]);
  const frameRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const likeStampRef = useRef<HTMLDivElement>(null);
  const passStampRef = useRef<HTMLDivElement>(null);
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

  // iPhone の Safari は、下へ引っ張る指の動きを自分の動き(アドレスバーを出す・ページを引っ張る)に
  // 使おうとして、カードのドラッグを途中で中止させる(pointercancel)。touch-action だけでは
  // 止まらないので、ドラッグ中はカードの上の touchmove を止めて、Safari に渡さない。
  // (React の onTouchMove は止められない設定なので、自分で登録する)
  useEffect(() => {
    const el = cardRef.current;
    if (!el || !isTop) return;
    function blockBrowserGesture(e: TouchEvent) {
      if (startRef.current) e.preventDefault();
    }
    el.addEventListener("touchmove", blockBrowserGesture, { passive: false });
    return () => el.removeEventListener("touchmove", blockBrowserGesture);
  }, [isTop]);

  function reduceMotion(): boolean {
    return (
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function threshold(): number {
    const width = cardRef.current?.offsetWidth ?? 340;
    return Math.min(SWIPE_THRESHOLD_MAX, width * SWIPE_THRESHOLD_RATIO);
  }

  function rotationFor(dx: number): number {
    const grab = startRef.current?.grab ?? 1;
    return Math.max(-MAX_ROTATE, Math.min(MAX_ROTATE, dx * ROTATE_PER_PX * grab));
  }

  /** カードを (dx, dy) に動かし、スタンプの濃さと、後ろのカードがせり出す量もそろえる。 */
  function paint(dx: number, dy: number, rotate: number) {
    const el = cardRef.current;
    if (!el) return;
    el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rotate}deg)`;
    const t = threshold();
    if (likeStampRef.current)
      likeStampRef.current.style.opacity = String(Math.min(Math.max(dx / t, 0), 1));
    if (passStampRef.current)
      passStampRef.current.style.opacity = String(Math.min(Math.max(-dx / t, 0), 1));
    // 後ろのカードは CSS 変数 --swipe(0〜1)で少しずつ大きく・手前に出てくる
    el.parentElement?.style.setProperty("--swipe", String(Math.min(Math.abs(dx) / t, 1)));
  }

  function commit(direction: "like" | "pass", velocity?: { x: number; y: number }) {
    if (flying) return;
    const el = cardRef.current;
    setFlying(direction);
    onCommit?.(direction);
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(8);

    // 投げた向きのまま画面の外へ。勢いがあればその傾き、なければ指を動かした傾きで飛ばす。
    const { dx, dy } = posRef.current;
    const sign = direction === "like" ? 1 : -1;
    const targetX = sign * (window.innerWidth + (el?.offsetWidth ?? 400));
    const slope =
      velocity && Math.abs(velocity.x) > 0.1 ? velocity.y / velocity.x : dx !== 0 ? dy / dx : -0.12;
    const targetY = dy + (targetX - dx) * Math.max(-0.9, Math.min(0.9, slope));
    const instant = reduceMotion();
    if (el)
      el.style.transition = instant ? "none" : `transform ${FLY_MS}ms cubic-bezier(.2,.75,.35,1)`;
    paint(targetX, targetY, sign * MAX_ROTATE * (startRef.current?.grab ?? 1));
    startRef.current = null;
    // prefers-reduced-motion: 見た目の動きもなくし、次のカードへの切り替えも待たせない(8.2)。
    window.setTimeout(
      () => {
        onAdvance?.();
        // 次のカードが一番上になってから、後ろのカードのせり出しを元に戻す
        requestAnimationFrame(() =>
          requestAnimationFrame(() => el?.parentElement?.style.setProperty("--swipe", "0")),
        );
      },
      instant ? 0 : FLY_MS - 40,
    );
  }

  useImperativeHandle(ref, () => ({ commit: (direction) => commit(direction) }));

  function snapBack() {
    const el = cardRef.current;
    posRef.current = { dx: 0, dy: 0 };
    if (el) {
      el.style.transition = reduceMotion()
        ? "none"
        : `transform ${SNAP_BACK_MS}ms cubic-bezier(.175,.885,.32,1.275)`;
    }
    paint(0, 0, 0);
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || flying) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // 指を追いかけられなくても、ドラッグ自体は続けられる
    }
    const rect = e.currentTarget.getBoundingClientRect();
    startRef.current = {
      x: e.clientX,
      y: e.clientY,
      grab: e.clientY - rect.top < rect.height / 2 ? 1 : -1,
    };
    posRef.current = { dx: 0, dy: 0 };
    historyRef.current = [{ x: e.clientX, y: e.clientY, t: e.timeStamp }];
    e.currentTarget.style.transition = "none";
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || !startRef.current || flying) return;
    // 縦も横も指と同じだけ動かす(1対1)
    posRef.current = { dx: e.clientX - startRef.current.x, dy: e.clientY - startRef.current.y };
    const history = historyRef.current;
    history.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
    if (history.length > HISTORY_SIZE) history.shift();
    // 画面の書き換え1回分に1回だけ動かす(動きが多くても重くならない)
    if (frameRef.current === null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const { dx, dy } = posRef.current;
        paint(dx, dy, rotationFor(dx));
      });
    }
  }

  /** 離す直前(VELOCITY_WINDOW_MS)の動きだけで勢いを測る。止めてから離したら勢いは0。 */
  function releaseVelocity(releaseAt: number): { x: number; y: number } {
    const recent = historyRef.current.filter((h) => releaseAt - h.t <= VELOCITY_WINDOW_MS);
    if (recent.length < 2) return { x: 0, y: 0 };
    const first = recent[0];
    const last = recent[recent.length - 1];
    const dt = Math.max(last.t - first.t, 1);
    return { x: (last.x - first.x) / dt, y: (last.y - first.y) / dt };
  }

  function flipPhoto(step: 1 | -1) {
    setWantedPhoto((i) => Math.min(Math.max(i + step, 0), photos.length - 1));
    onPhotoFlip?.();
  }

  /** 写真の右半分をタップで次、左半分で前の写真。 */
  function handleTap(clientX: number, clientY: number) {
    const rect = photoAreaRef.current?.getBoundingClientRect();
    if (!rect || clientY < rect.top || clientY > rect.bottom) return;
    flipPhoto(clientX - rect.left > rect.width / 2 ? 1 : -1);
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!isTop || !startRef.current || flying) return;
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const start = startRef.current;
    if (Math.hypot(e.clientX - start.x, e.clientY - start.y) < TAP_SLOP) {
      startRef.current = null;
      snapBack();
      if (e.type === "pointerup") handleTap(e.clientX, e.clientY);
      return;
    }
    const { dx } = posRef.current;
    const v = releaseVelocity(e.timeStamp);
    const passedDistance = Math.abs(dx) > threshold();
    // 素早くはじいたら、距離が短くても確定(はじいた向きと動かした向きが同じときだけ)
    const flicked = Math.abs(v.x) > VELOCITY_THRESHOLD && Math.sign(v.x) === Math.sign(dx || v.x);
    if (passedDistance || flicked) {
      commit((flicked ? v.x : dx) > 0 ? "like" : "pass", v);
    } else {
      startRef.current = null;
      snapBack();
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

  // 一番上のカードの位置は paint() が直接動かすので、ここでは決めない。
  // すぐ後ろのカードは、上のカードをドラッグするほど(--swipe)大きく・手前に出てくる。
  const backTransform =
    position === 1
      ? "translateY(calc(14px * (1 - var(--swipe, 0)))) scale(calc(0.96 + 0.04 * var(--swipe, 0)))"
      : `translateY(${14 * position}px) scale(${1 - 0.04 * position})`;

  const frame = store.priceTier ? PRICE_TIER_COLORS[store.priceTier] : PRICE_UNKNOWN_FRAME;

  return (
    <div
      ref={cardRef}
      className="absolute inset-0 flex touch-none select-none flex-col overflow-hidden rounded-[24px] shadow-card [-webkit-touch-callout:none]"
      style={{
        backgroundColor: frame.bg,
        padding: `0 ${FRAME_PX}px ${FRAME_PX}px`,
        ...(isTop
          ? { touchAction: "none", willChange: "transform" }
          : { transform: backTransform, transition: "transform .2s ease-out" }),
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
                ref={likeStampRef}
                className="pointer-events-none absolute right-6 top-6 rounded-lg border-4 border-accent px-3 py-1 text-lg font-black text-accent opacity-0"
                style={{ transform: "rotate(-12deg)" }}
              >
                👍 食べたい
              </div>
              <div
                ref={passStampRef}
                className="pointer-events-none absolute left-6 top-6 rounded-lg border-4 border-text-secondary px-3 py-1 text-lg font-black text-text-secondary opacity-0"
                style={{ transform: "rotate(12deg)" }}
              >
                ❌ パス
              </div>
            </>
          )}
        </div>
        <div className="flex flex-col gap-1 px-5 py-4">
          <h2 className="text-[26px] font-black leading-tight text-text-primary">{store.name}</h2>
          <p className="font-mono text-sm text-text-secondary">
            {showTravelTime ? (
              <TravelTime store={store} />
            ) : (
              OPEN_STATUS_TEXT[openStatus(store, Date.now())]
            )}
            {store.price ? ` / ${store.price}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
});
