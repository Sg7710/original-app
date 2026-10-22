"use client";

export const TODAY = "今日";
export const YESTERDAY = "昨日";

/** 一覧を日付ごとに分けるときの見出し: 「今日」「昨日」、それより前は「10/16」。 */
export function dayLabel(date: Date, today: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const diffDays = Math.round((t - d) / 86_400_000);
  if (diffDays === 0) return TODAY;
  if (diffDays === 1) return YESTERDAY;
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

/** 押すと開いたりたためたりする日付の見出し(「今日 10/19 ・2件 ▲ 閉じる」)。 */
export function DayHeader({
  label,
  date,
  count,
  open,
  onToggle,
}: {
  label: string;
  date: Date;
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex h-9 items-center gap-2 text-left"
    >
      <span className="text-[13px] font-bold text-text-primary">{label}</span>
      {/* 「今日」「昨日」のときだけ日付を横に添える(それ以外は見出しがもう日付) */}
      {(label === TODAY || label === YESTERDAY) && (
        <span className="font-mono text-[10px] text-text-tertiary">
          {date.getMonth() + 1}/{date.getDate()}
        </span>
      )}
      <span className="text-[11px] text-text-secondary">・{count}件</span>
      <span aria-hidden className="ml-auto text-xs text-text-tertiary">
        {open ? "▲ 閉じる" : "▼ 見る"}
      </span>
    </button>
  );
}
