"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FRAME_CLASS } from "@/components/meshi/frame";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

type Status = "form" | "sending" | "confirm-email";

export function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || status === "sending") return;

    if (password !== confirmPassword) {
      setErrorMessage("パスワードが一致しません。");
      return;
    }

    setStatus("sending");
    setErrorMessage(null);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setErrorMessage(authErrorMessage(error, "登録に失敗しました。もう一度お試しください。"));
      setStatus("form");
      return;
    }

    if (data.session) {
      // メール確認が不要な設定の場合、登録と同時にログイン済みになる。
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = "/";
      return;
    }

    setStatus("confirm-email");
  }

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        {status === "confirm-email" ? (
          <>
            <h2 className="text-lg font-bold text-text-primary">メールを確認してください</h2>
            <p className="text-sm text-text-secondary">
              {email} に確認メールを送りました。メール内のリンクを開くと登録が完了します。
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              ※ メールを開くのと同じブラウザでリンクを開いてください。
            </p>
            <Link href="/login" className="mt-4 text-xs font-bold text-text-tertiary">
              ログイン画面に戻る
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-text-primary">新規登録</h2>
            <p className="text-sm text-text-secondary">
              メールアドレスとパスワードを入力してください。
            </p>
            <form
              onSubmit={handleSubmit}
              className="mt-4 flex w-full max-w-[280px] flex-col gap-3"
            >
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="パスワード(6文字以上)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                placeholder="パスワード(確認)"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
              />
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary disabled:opacity-60"
              >
                {status === "sending" ? "登録中…" : "登録する"}
              </button>
              <p role="alert" aria-live="assertive" className="text-xs text-[#D8452F]">
                {errorMessage}
              </p>
            </form>
            <Link href="/login" className="mt-4 text-xs font-bold text-text-tertiary">
              すでにアカウントをお持ちの方はこちら
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
