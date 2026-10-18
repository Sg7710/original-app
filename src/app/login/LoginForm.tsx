"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FRAME_CLASS } from "@/components/meshi/frame";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

interface LoginFormProps {
  initialError: string | null;
  notice: string | null;
}

export function LoginForm({ initialError, notice }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialError);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password || sending) return;

    setSending(true);
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSending(false);

    if (error) {
      setErrorMessage(authErrorMessage(error, "ログインに失敗しました。もう一度お試しください。"));
      return;
    }
    // Full reload so the server re-checks the session cookie signInWithPassword just set.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/";
  }

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-lg font-bold text-text-primary">ログイン</h2>
        <p className="text-sm text-text-secondary">メールアドレスとパスワードを入力してください。</p>
        {notice && !errorMessage && (
          <p role="status" className="mt-2 text-xs font-bold text-[#2E9E63]">
            {notice}
          </p>
        )}
        <form onSubmit={handleSubmit} className="mt-4 flex w-full max-w-[280px] flex-col gap-3">
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
            autoComplete="current-password"
            placeholder="パスワード"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-full border border-card-border bg-white px-4 text-center text-sm text-text-primary"
          />
          <button
            type="submit"
            disabled={sending}
            className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary disabled:opacity-60"
          >
            {sending ? "ログイン中…" : "ログイン"}
          </button>
          <p role="alert" aria-live="assertive" className="text-xs text-[#D8452F]">
            {errorMessage}
          </p>
          <Link href="/reset-password" className="text-xs font-bold text-text-tertiary">
            パスワードを忘れた方
          </Link>
        </form>

        <div className="mt-4 flex w-full max-w-[280px] items-center gap-3">
          <span className="h-px flex-1 bg-card-border" />
          <span className="text-xs text-text-tertiary">または</span>
          <span className="h-px flex-1 bg-card-border" />
        </div>
        <div className="mt-4 w-full max-w-[280px]">
          <GoogleLoginButton />
        </div>

        <Link href="/signup" className="mt-4 text-xs font-bold text-text-tertiary">
          アカウントをお持ちでない方はこちら
        </Link>
      </div>
    </div>
  );
}
