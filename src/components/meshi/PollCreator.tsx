"use client";

import { useEffect, useState } from "react";
import type { Store } from "@/types/store";
import {
  createPoll,
  DEFAULT_POLL_TITLE,
  NotLoggedInError,
  POLL_MAX_OPTIONS,
  POLL_MIN_OPTIONS,
  POLL_TITLE_MAX,
  pollUrl,
} from "@/lib/meshi/polls";
import { DayHeader, TODAY } from "./DayHeader";
import type { RouletteDay } from "./Roulette";

interface PollCreatorProps {
  /** 「リスト」の日付ごとの店(ルーレットと同じ形) */
  days: (RouletteDay & { date: Date })[];
  /** まだ取り直していない日を開いたときに、その日の店を取りに行く(開くだけで閉じない) */
  onNeedDay: (label: string) => void;
  loading: boolean;
  /** 作った投票を「投票中」の帯に出すため */
  onCreated: () => void;
  onClose: () => void;
}

/**
 * 「リスト」の店から投票を作る画面。タイトルと候補(2〜6軒)を選んで作ると、
 * 投票ページのURLを共有する画面に変わる。投票ページは /poll/[id]。
 */
export function PollCreator({ days, onNeedDay, loading, onCreated, onClose }: PollCreatorProps) {
  const [title, setTitle] = useState(DEFAULT_POLL_TITLE);
  const [picked, setPicked] = useState<string[]>([]);
  const [openDays, setOpenDays] = useState<Set<string>>(() => new Set([TODAY]));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const full = picked.length >= POLL_MAX_OPTIONS;
  const canCreate = picked.length >= POLL_MIN_OPTIONS && !saving;

  // 「今日」は最初から開いているので、その日の店を取っておく。
  useEffect(() => {
    onNeedDay(TODAY);
  }, [onNeedDay]);

  function toggleDay(label: string) {
    const opening = !openDays.has(label);
    setOpenDays((prev) => {
      const next = new Set(prev);
      if (opening) next.add(label);
      else next.delete(label);
      return next;
    });
    if (opening) onNeedDay(label);
  }

  function togglePick(placeId: string) {
    setPicked((prev) =>
      prev.includes(placeId)
        ? prev.filter((id) => id !== placeId)
        : prev.length >= POLL_MAX_OPTIONS
          ? prev
          : [...prev, placeId],
    );
  }

  async function create() {
    if (!canCreate) return;
    setSaving(true);
    setError(null);
    try {
      const id = await createPoll(title, picked);
      setCreatedUrl(pollUrl(id));
      onCreated();
    } catch (err) {
      // 原因を調べられるように、Supabase からのくわしい理由を Console に出す
      console.error("[polls] could not create poll:", err);
      setError(
        err instanceof NotLoggedInError
          ? "投票を作るにはログインが必要です。"
          : "投票を作れませんでした。時間をおいてもう一度お試しください。",
      );
    } finally {
      setSaving(false);
    }
  }

  async function share() {
    if (!createdUrl) return;
    try {
      await navigator.share({ title, text: `「${title}」に投票してね`, url: createdUrl });
    } catch {
      // 共有をやめた・使えない端末: 何もしない(コピーボタンがある)
    }
  }

  async function copy() {
    if (!createdUrl) return;
    try {
      await navigator.clipboard.writeText(createdUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="投票を作る"
      className="absolute inset-0 z-[90] flex flex-col bg-app"
    >
      <div className="flex shrink-0 items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-lg font-black text-text-primary">
          {createdUrl ? "投票を作りました" : "投票を作る"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="h-10 rounded-full bg-tab-active px-4 text-sm font-bold text-text-secondary"
        >
          ✕ 閉じる
        </button>
      </div>

      {createdUrl ? (
        /* ── 共有 ── */
        <div className="flex flex-1 flex-col gap-4 px-5 pb-8">
          <div className="flex flex-col items-center gap-1 rounded-[22px] bg-white px-5 py-6 text-center shadow-card">
            <p className="text-3xl" aria-hidden>
              🗳
            </p>
            <p className="text-base font-black text-text-primary">{title}</p>
            <p className="text-xs text-text-secondary">
              候補{picked.length}軒・作った人が「終わる」を押すまで(最長3日)
            </p>
          </div>
          <p className="text-xs font-bold text-text-secondary">このURLを友達に送ってください</p>
          <input
            id="poll-url"
            readOnly
            value={createdUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="h-11 rounded-[14px] border border-card-border bg-white px-3 font-mono text-base text-text-primary"
          />
          <div className="flex flex-col gap-2.5">
            {canShare && (
              <button
                type="button"
                onClick={share}
                className="h-[52px] rounded-[26px] bg-accent text-sm font-black text-text-primary"
              >
                LINEなどで送る
              </button>
            )}
            <button
              type="button"
              onClick={copy}
              className="h-[52px] rounded-[26px] border border-card-border bg-white text-sm font-bold text-text-primary"
            >
              {copied ? "コピーしました" : "URLをコピー"}
            </button>
            <a
              href={createdUrl}
              className="flex h-[52px] items-center justify-center rounded-[26px] text-sm font-bold text-text-secondary"
            >
              投票ページを開く
            </a>
          </div>
        </div>
      ) : (
        /* ── 作る ── */
        <>
          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text-secondary">タイトル</span>
              <input
                id="poll-title"
                value={title}
                maxLength={POLL_TITLE_MAX}
                onChange={(e) => setTitle(e.target.value)}
                className="h-11 rounded-[14px] border border-card-border bg-white px-3 text-base text-text-primary"
              />
            </label>

            <div className="flex items-baseline justify-between">
              <p className="text-xs font-bold text-text-secondary">
                候補を選ぶ（{POLL_MIN_OPTIONS}〜{POLL_MAX_OPTIONS}軒）
              </p>
              <p className="font-mono text-xs font-bold text-text-primary">
                {picked.length}/{POLL_MAX_OPTIONS}
              </p>
            </div>

            {days.map((day) => {
              const open = openDays.has(day.label);
              return (
                <section key={day.label} className="flex flex-col gap-2">
                  <DayHeader
                    label={day.label}
                    date={day.date}
                    count={day.entryCount}
                    open={open}
                    onToggle={() => toggleDay(day.label)}
                  />
                  {open && day.stores.length === 0 && loading && (
                    <p className="text-center text-xs text-text-tertiary">読み込んでいます…</p>
                  )}
                  {open &&
                    day.stores.map((store: Store) => {
                      const on = picked.includes(store.placeId);
                      const disabled = !on && full;
                      return (
                        <button
                          key={store.placeId}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          disabled={disabled}
                          onClick={() => togglePick(store.placeId)}
                          className={`flex items-center gap-3 rounded-[16px] border bg-white p-2.5 text-left ${
                            on ? "border-accent" : "border-card-border"
                          } ${disabled ? "opacity-40" : ""}`}
                        >
                          <span
                            aria-hidden
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                              on
                                ? "bg-accent text-white"
                                : "border-[1.5px] border-[rgba(26,24,19,0.2)] bg-white"
                            }`}
                          >
                            {on ? "✓" : ""}
                          </span>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={store.photoUrl}
                            alt=""
                            className="h-12 w-12 shrink-0 rounded-[12px] object-cover"
                          />
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-bold text-text-primary">
                              {store.name}
                            </span>
                            <span className="truncate text-[11px] text-text-secondary">
                              {store.genre}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                </section>
              );
            })}
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-card-border bg-app px-5 py-3">
            {error && (
              <p role="alert" className="text-center text-xs font-bold text-[#D8452F]">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={create}
              disabled={!canCreate}
              className="h-[52px] rounded-[26px] bg-text-primary text-sm font-black text-white disabled:opacity-40"
            >
              {saving
                ? "作っています…"
                : picked.length < POLL_MIN_OPTIONS
                  ? `あと${POLL_MIN_OPTIONS - picked.length}軒選んでください`
                  : `${picked.length}軒で投票を作る`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
