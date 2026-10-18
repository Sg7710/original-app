"use client";

export type Tab = "swipe" | "fav" | "profile";

interface BottomTabBarProps {
  tab: Tab;
  favCount: number;
  onChange: (tab: Tab) => void;
}

const TABS: { key: Tab; icon: string; label: string }[] = [
  { key: "swipe", icon: "👍", label: "スワイプ" },
  { key: "fav", icon: "📋", label: "食べたいリスト" },
  { key: "profile", icon: "👤", label: "プロフィール" },
];

export function BottomTabBar({ tab, favCount, onChange }: BottomTabBarProps) {
  return (
    <div className="flex shrink-0 gap-2 border-t border-card-border bg-white px-5 pb-[30px] pt-2.5">
      {TABS.map((t) => {
        const active = tab === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-current={active ? "page" : undefined}
            data-onboarding-target={t.key === "fav" ? "fav-tab" : undefined}
            onClick={() => onChange(t.key)}
            className={`relative flex h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-[18px] text-[11px] font-bold ${
              active ? "bg-tab-active text-text-primary" : "text-text-tertiary"
            }`}
          >
            <span aria-hidden className={`text-lg leading-none ${active ? "" : "opacity-60"}`}>
              {t.icon}
            </span>
            {t.label}
            {t.key === "fav" && favCount > 0 && (
              <span className="absolute right-2 top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 font-mono text-[11px] font-bold text-text-primary">
                {favCount}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
