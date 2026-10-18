"use client";

import { useState } from "react";
import { saveDisplayName, useAccount } from "@/hooks/useAccount";
import { SearchConditionsFields } from "./SearchConditions";
import { signOutToLogin } from "@/lib/supabase/sign-out";

interface SettingsPanelProps {
  onShowTutorial: () => void;
  /** After 「この条件でお店を探す」: go show the stores. */
  onSearch: () => void;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-[13px] font-bold text-text-secondary">{title}</h2>
      <div className="flex flex-col gap-4 rounded-[20px] border border-card-border bg-white p-4">
        {children}
      </div>
    </section>
  );
}

/** The プロフィール tab: profile + swipe conditions. */
export function SettingsPanel({ onShowTutorial, onSearch }: SettingsPanelProps) {
  const account = useAccount();
  const [nameDraft, setNameDraft] = useState(account.displayName ?? account.name);
  const [nameStatus, setNameStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameStatus("saving");
    try {
      await saveDisplayName(nameDraft);
      setNameStatus("saved");
    } catch {
      setNameStatus("error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="shrink-0 px-5 pb-3 pt-5">
        <h1 className="text-2xl font-black text-text-primary">プロフィール</h1>
      </div>

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-5 pb-8">
        <Section title="プロフィール">
          <form onSubmit={handleSaveName} className="flex flex-col gap-2">
            <label htmlFor="display-name" className="text-xs font-bold text-text-primary">
              表示名
            </label>
            <div className="flex gap-2">
              <input
                id="display-name"
                value={nameDraft}
                maxLength={20}
                onChange={(e) => {
                  setNameDraft(e.target.value);
                  setNameStatus("idle");
                }}
                className="h-11 min-w-0 flex-1 rounded-full border border-card-border bg-app px-4 text-sm text-text-primary"
              />
              <button
                type="submit"
                disabled={nameStatus === "saving"}
                className="h-11 shrink-0 rounded-full bg-accent px-4 text-xs font-bold text-text-primary disabled:opacity-60"
              >
                {nameStatus === "saving" ? "保存中…" : "保存"}
              </button>
            </div>
            <p role="status" aria-live="polite" className="text-[11px] text-text-tertiary">
              {nameStatus === "saved"
                ? "保存しました"
                : nameStatus === "error"
                  ? "保存できませんでした。もう一度お試しください。"
                  : "20文字まで"}
            </p>
          </form>
          {account.email && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-bold text-text-primary">メールアドレス</p>
              <p className="truncate text-sm text-text-secondary">{account.email}</p>
            </div>
          )}
        </Section>

        <Section title="お店の探し方">
          <SearchConditionsFields onApplied={onSearch} />
        </Section>

        <Section title="その他">
          <button
            type="button"
            onClick={onShowTutorial}
            className="h-11 rounded-full border border-card-border text-sm font-bold text-text-primary"
          >
            使い方をもう一度見る
          </button>
        </Section>

        <button
          type="button"
          disabled={loggingOut}
          onClick={() => {
            setLoggingOut(true);
            void signOutToLogin();
          }}
          className="h-12 rounded-full border border-card-border bg-white text-sm font-bold text-[#A3301F] disabled:opacity-60"
        >
          {loggingOut ? "ログアウト中…" : "ログアウト"}
        </button>
      </div>
    </div>
  );
}
