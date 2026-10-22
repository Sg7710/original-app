"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Store } from "@/types/store";
import { useAccount } from "@/hooks/useAccount";
import {
  castVotes,
  closePoll,
  finalizeIfExpired,
  getPoll,
  getPollResults,
  savedVoterName,
  saveVoterName,
  VOTER_NAME_MAX,
  type Poll,
  resolveTie,
  type PollResults,
} from "@/lib/meshi/polls";
import { RunoffLink, TieChooser, WinnerReveal } from "./PollFinal";
import { FRAME_CLASS } from "./frame";
import { SwipeTab } from "./SwipeTab";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 結果の画面を開いている間、この間隔で票を読み直す(Supabase だけなので Google の料金はかからない)。 */
const RESULTS_REFRESH_MS = 10_000;

type Load =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "error" }
  | { kind: "ok"; poll: Poll; stores: Store[] };

type Step = "checking" | "name" | "swipe" | "sending" | "results" | "final";

/** 投票を読む。3日たって自動で終わっていたら、その場で決めてから読み直す。 */
async function loadPoll(id: string): Promise<Poll | null> {
  const poll = await getPoll(id);
  if (poll && !poll.isOpen && poll.closedAt === null) {
    await finalizeIfExpired(id);
    return getPoll(id);
  }
  return poll;
}

async function fetchPollStores(id: string): Promise<Store[]> {
  const res = await fetch(`/api/polls/${id}/stores`);
  if (!res.ok) throw new Error(`status ${res.status}`);
  return ((await res.json()) as { stores: Store[] }).stores;
}

/**
 * 投票ページ(/poll/[id])。ログインなしで開ける。名前を入れて候補をスワイプ(右=行きたい /
 * 左=パス)し、全部答えたらまとめて送って結果を見る。結果は投票した人と作った人だけが見られる
 * (終わった投票は誰でも)。締め切りまでは何度でもやり直せる。
 */
export function PollPage({ id }: { id: string }) {
  const account = useAccount();
  const [load, setLoad] = useState<Load>(() =>
    UUID_PATTERN.test(id) ? { kind: "loading" } : { kind: "missing" },
  );
  const [step, setStep] = useState<Step>("checking");
  const [name, setName] = useState("");
  const [draftName, setDraftName] = useState("");
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState<PollResults | null>(null);
  const [sendError, setSendError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(false);

  // 投票と候補のお店を読む
  useEffect(() => {
    if (!UUID_PATTERN.test(id)) return;
    let cancelled = false;
    (async () => {
      try {
        const poll = await loadPoll(id);
        if (!poll) {
          if (!cancelled) setLoad({ kind: "missing" });
          return;
        }
        const stores = await fetchPollStores(id);
        if (!cancelled) setLoad({ kind: "ok", poll, stores });
      } catch {
        if (!cancelled) setLoad({ kind: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // 投票そのもの(終わったか・決まった店・決選投票)を読み直す。候補のお店はそのまま使う。
  const refreshPoll = useCallback(async () => {
    try {
      const poll = await loadPoll(id);
      if (!poll) return;
      setLoad((prev) => (prev.kind === "ok" ? { ...prev, poll } : prev));
      if (!poll.isOpen) setStep((st) => (st === "results" ? "final" : st));
    } catch {
      // 読み直しに失敗しても、前の内容を出したままにする
    }
  }, [id]);

  const refreshResults = useCallback(async () => {
    try {
      setResults(await getPollResults(id));
    } catch {
      // 読み直しに失敗しても、前の結果を出したままにする
    }
  }, [id]);

  // 最初に、もう投票済みか(結果が見られるか)と、名前が決まっているかを調べる
  useEffect(() => {
    if (load.kind !== "ok" || !account.loaded || step !== "checking") return;
    // 名前の欄に最初から入れておく名前: プロフィールの表示名 → この端末で前に使った名前 →
    // ログインしているならアカウントの名前(Googleの名前など)。
    const known =
      account.displayName?.trim() || savedVoterName() || (account.email ? account.name : "");
    (async () => {
      const r = await getPollResults(id).catch(() => null);
      setResults(r);
      setName(known);
      setDraftName(known);
      // 終わった投票は誰でも結果と決まった店が見られる。受付中は、まだなら先に投票する
      // (作った人も同じ。結果を先に見てつられないように)。
      if (!load.poll.isOpen) setStep("final");
      else if (r?.hasVoted) setStep("results");
      // 名前の画面は毎回出す(最初から入っているので、確かめて押すだけ。変えたければここで変える)
      else setStep("name");
    })();
  }, [load, account.loaded, account.email, account.name, account.displayName, id, step]);

  // 結果・発表の画面を開いている間は、10秒ごとに読み直す(終わった・決まった、もここで気づく)
  const settled =
    load.kind === "ok" && (load.poll.winnerPlaceId !== null || load.poll.runoffPollId !== null);
  useEffect(() => {
    if (step !== "results" && !(step === "final" && !settled)) return;
    const timer = window.setInterval(() => {
      void refreshPoll();
      void refreshResults();
    }, RESULTS_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [step, settled, refreshPoll, refreshResults]);

  async function endPoll() {
    setBusy(true);
    setActionError(false);
    try {
      await closePoll(id);
      await refreshPoll();
      await refreshResults();
      setStep("final");
    } catch (err) {
      console.error("[polls] could not close poll:", err);
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  async function chooseTieBreak(method: "roulette" | "runoff") {
    setBusy(true);
    setActionError(false);
    try {
      await resolveTie(id, method);
      await refreshPoll();
    } catch (err) {
      console.error("[polls] could not resolve tie:", err);
      setActionError(true);
    } finally {
      setBusy(false);
    }
  }

  const stores = load.kind === "ok" ? load.stores : [];

  // スワイプの答えは ref にも持つ(カードを送り出す処理は少し遅れて呼ばれるので、
  // そのときの最新の答えを確実に使うため)。
  const answersRef = useRef<Record<string, boolean>>({});

  function answer(placeId: string, wants: boolean) {
    answersRef.current = { ...answersRef.current, [placeId]: wants };
  }

  // 1枚送り出すたびに呼ばれる。最後の1枚なら、答えをまとめて送る。
  function advance() {
    setIdx((i) => i + 1);
    if (Object.keys(answersRef.current).length < stores.length) return;
    setStep("sending");
    setSendError(false);
    castVotes(id, name, answersRef.current)
      .then(async () => {
        await refreshResults();
        setStep("results");
      })
      .catch((err) => {
        // 原因を調べられるように、Supabase からのくわしい理由を Console に出す
        console.error("[polls] could not send votes:", err);
        setSendError(true);
        answersRef.current = {};
        setIdx(0);
        setStep("swipe");
      });
  }

  function startOver() {
    answersRef.current = {};
    setIdx(0);
    setStep("swipe");
  }

  function confirmName() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    saveVoterName(trimmed);
    setName(trimmed);
    setStep("swipe");
  }

  return (
    <div className={FRAME_CLASS}>
      {load.kind === "ok" && (
        <header className="flex shrink-0 flex-col gap-0.5 px-5 pb-2 pt-5">
          <p className="text-[11px] font-bold text-[#8F5E10]">
            🗳 {load.poll.isOpen ? "投票受付中" : "投票は終わりました"}
          </p>
          <h1 className="text-2xl font-black text-text-primary">{load.poll.title}</h1>
        </header>
      )}

      {load.kind !== "ok" && (
        <Center>
          {load.kind === "loading" && (
            <p className="text-sm text-text-secondary">読み込んでいます…</p>
          )}
          {load.kind === "missing" && (
            <Message
              title="投票が見つかりません"
              body="URLが正しいか、送ってくれた人に確かめてください。"
            />
          )}
          {load.kind === "error" && (
            <Message
              title="投票を読み込めませんでした"
              body="時間をおいて、もう一度開いてください。"
            />
          )}
          <TopLink />
        </Center>
      )}

      {load.kind === "ok" && step === "checking" && (
        <Center>
          <p className="text-sm text-text-secondary">読み込んでいます…</p>
        </Center>
      )}

      {load.kind === "ok" && step === "name" && (
        <Center>
          <p className="text-sm text-text-secondary">
            候補{stores.length}軒をスワイプして、行きたいお店を選んでください。
          </p>
          <label className="flex w-full max-w-[300px] flex-col gap-1.5 text-left">
            <span className="text-xs font-bold text-text-secondary">あなたの名前</span>
            <input
              id="voter-name"
              value={draftName}
              maxLength={VOTER_NAME_MAX}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmName()}
              placeholder="例：ゆき"
              className="h-12 rounded-[14px] border border-card-border bg-white px-3 text-base text-text-primary"
            />
          </label>
          <button
            type="button"
            onClick={confirmName}
            disabled={!draftName.trim()}
            className="h-12 w-full max-w-[300px] rounded-full bg-accent text-sm font-black text-text-primary disabled:opacity-40"
          >
            投票をはじめる
          </button>
        </Center>
      )}

      {load.kind === "ok" && step === "swipe" && (
        <>
          <p className="shrink-0 px-5 text-xs text-text-secondary">
            {name}さん、行きたい店は右、パスは左へスワイプ
            {sendError && (
              <span role="alert" className="mt-1 block font-bold text-[#D8452F]">
                送れませんでした。もう一度スワイプしてください。
              </span>
            )}
          </p>
          <SwipeTab
            stores={stores}
            idx={idx}
            showTravelTime={false}
            onAdvance={advance}
            onLike={(placeId) => answer(placeId, true)}
            onPass={(placeId) => answer(placeId, false)}
          />
        </>
      )}

      {load.kind === "ok" && step === "sending" && (
        <Center>
          <p className="text-sm text-text-secondary">投票を送っています…</p>
        </Center>
      )}

      {load.kind === "ok" && step === "results" && (
        <ResultsView
          stores={stores}
          results={results}
          actions={
            <>
              <button
                type="button"
                onClick={startOver}
                className="h-12 w-full rounded-full border border-card-border bg-white text-sm font-bold text-text-primary"
              >
                投票し直す
              </button>
              {load.poll.isOwner && <EndPollButton busy={busy} onEnd={endPoll} />}
              {actionError && (
                <p role="alert" className="text-center text-xs font-bold text-[#D8452F]">
                  うまくいきませんでした。もう一度押してください。
                </p>
              )}
            </>
          }
        />
      )}

      {load.kind === "ok" && step === "final" && (
        <ResultsView
          stores={stores}
          results={results}
          winnerPlaceId={load.poll.winnerPlaceId}
          header={
            load.poll.runoffPollId ? (
              <RunoffLink runoffPollId={load.poll.runoffPollId} />
            ) : load.poll.winnerPlaceId ? (
              <WinnerReveal poll={load.poll} stores={stores} />
            ) : load.poll.tiedPlaceIds ? (
              <TieChooser
                poll={load.poll}
                stores={stores}
                busy={busy}
                error={actionError}
                onChoose={chooseTieBreak}
              />
            ) : null
          }
        />
      )}
    </div>
  );
}

function ResultsView({
  stores,
  results,
  header,
  actions,
  winnerPlaceId = null,
}: {
  stores: Store[];
  results: PollResults | null;
  /** 結果の上に出すもの(決まった店の発表など) */
  header?: React.ReactNode;
  /** 下に固定するボタン */
  actions?: React.ReactNode;
  /** 決まった店。あればその店を強調する(なければ票が一番多い店) */
  winnerPlaceId?: string | null;
}) {
  const voters = results?.voters ?? 0;
  const rows = stores
    .map((store) => ({
      store,
      names: results?.places.find((p) => p.placeId === store.placeId)?.names ?? [],
    }))
    .sort((a, b) => b.names.length - a.names.length);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-1 flex-col overflow-y-auto">
        {header}
        <p className="shrink-0 px-5 pb-3 text-xs text-text-secondary" aria-live="polite">
          {voters}人が投票{actions ? "・10秒ごとに更新" : ""}
        </p>
        <ul className="flex flex-col gap-3 px-5 pb-5">
          {rows.map(({ store, names }, i) => (
            <li
              key={store.placeId}
              className={`flex flex-col gap-2 rounded-[20px] border bg-white p-3 ${
                (winnerPlaceId ? store.placeId === winnerPlaceId : i === 0 && names.length > 0)
                  ? "border-accent"
                  : "border-card-border"
              }`}
            >
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={store.photoUrl}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-[14px] object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="text-[15px] font-bold leading-snug text-text-primary">
                    {store.name}
                  </p>
                  <p className="truncate text-[11px] text-text-secondary">{store.genre}</p>
                </div>
                <p className="shrink-0 font-mono text-lg font-black text-text-primary">
                  {names.length}
                  <span className="ml-0.5 text-xs font-bold text-text-secondary">票</span>
                </p>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-tab-active" aria-hidden>
                <div
                  className="h-full rounded-full bg-accent transition-[width] duration-500"
                  style={{ width: voters ? `${(names.length / voters) * 100}%` : "0%" }}
                />
              </div>
              {names.length > 0 && (
                <p className="text-[11px] text-text-secondary">{names.join("・")}</p>
              )}
            </li>
          ))}
        </ul>
      </div>
      {actions && (
        <div className="flex shrink-0 flex-col gap-2 border-t border-card-border bg-app px-5 py-3">
          {actions}
        </div>
      )}
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
      {children}
    </div>
  );
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <>
      <h2 className="text-lg font-bold text-text-primary">{title}</h2>
      <p className="text-sm text-text-secondary">{body}</p>
    </>
  );
}

function TopLink() {
  return (
    <Link href="/" className="mt-4 text-sm font-bold text-text-secondary underline">
      直観メシのトップへ
    </Link>
  );
}

/** 作った人だけの「投票を終わる」。押し間違えないよう、もう一度押して確定する。 */
function EndPollButton({ busy, onEnd }: { busy: boolean; onEnd: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="h-12 w-full rounded-full bg-text-primary text-sm font-black text-white"
      >
        投票を終わって1軒に決める
      </button>
    );
  }
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="h-12 flex-1 rounded-full border border-card-border bg-white text-sm font-bold text-text-secondary"
      >
        やめる
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={onEnd}
        className="h-12 flex-[2] rounded-full bg-[#D8452F] text-sm font-black text-white disabled:opacity-40"
      >
        {busy ? "決めています…" : "本当に終わる"}
      </button>
    </div>
  );
}
