"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { FRAME_CLASS } from "@/components/meshi/frame";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

export function NewPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password || sending) return;

    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません。");
      return;
    }

    setSending(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage(authErrorMessage(error, "変更に失敗しました。もう一度お試しください。"));
      setSending(false);
      return;
    }

    // Sign out so the user confirms the new password works by logging in with it.
    await supabase.auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/login?reset=done";
  }

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-lg font-bold text-text-primary">新しいパスワード</h2>
        <p className="text-sm text-text-secondary">新しいパスワードを入力してください。</p>
        <form onSubmit={handleSubmit} className="mt-4 flex w-full max-w-[280px] flex-col gap-3">
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="新しいパスワード(6文字以上)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="新しいパスワード(確認)"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
          />
          <button
            type="submit"
            disabled={sending}
            className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary disabled:opacity-60"
          >
            {sending ? "変更中…" : "パスワードを変更する"}
          </button>
          <p role="alert" aria-live="assertive" className="text-xs text-[#D8452F]">
            {errorMessage}
          </p>
        </form>
      </div>
    </div>
  );
}
