"use client";

import { useEffect, useState } from "react";
import { listMyOpenPolls, type PollSummary } from "@/lib/meshi/polls";

/**
 * 「リスト」タブの上に出す「🗳 投票中」の帯。自分が作った、まだ投票できる投票を
 * 新しい順に出し、押すと投票ページを開く。ログインしていなければ何も出さない。
 */
export function OpenPollsBanner({ version }: { version: number }) {
  const [polls, setPolls] = useState<PollSummary[]>([]);

  useEffect(() => {
    let cancelled = false;
    listMyOpenPolls()
      .then((p) => {
        if (!cancelled) setPolls(p);
      })
      .catch(() => {
        // 読めなくてもリストはそのまま使えるので、帯を出さないだけにする
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (polls.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {polls.map((p) => (
        <a
          key={p.id}
          href={`/poll/${p.id}`}
          className="flex items-center gap-3 rounded-[18px] border border-accent bg-[#FFF6E5] px-4 py-3"
        >
          <span aria-hidden className="text-xl">
            🗳
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-bold text-[#8F5E10]">投票中</span>
            <span className="truncate text-sm font-bold text-text-primary">{p.title}</span>
          </span>
          <span className="shrink-0 text-xs font-bold text-[#8F5E10]">開く ›</span>
        </a>
      ))}
    </div>
  );
}
