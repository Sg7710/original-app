"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { FRAME_CLASS } from "@/components/meshi/frame";
import { authErrorMessage } from "@/lib/supabase/auth-errors";

type Status = "form" | "sending" | "sent";

export function ResetRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || status === "sending") return;

    setStatus("sending");
    setErrorMessage(null);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password/confirm`,
    });

    if (error) {
      setErrorMessage(authErrorMessage(error, "送信に失敗しました。もう一度お試しください。"));
      setStatus("form");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        {status === "sent" ? (
          <>
            <h2 className="text-lg font-bold text-text-primary">メールを確認してください</h2>
            {/* Same wording whether or not the address is registered, so this
                screen can't be used to check who has an account. */}
            <p role="status" className="text-sm text-text-secondary">
              {email} が登録されていれば、パスワード再設定用のリンクを送りました。
            </p>
            <p className="mt-1 text-xs text-text-tertiary">
              ※ メールを開くのと同じブラウザでリンクを開いてください。
            </p>
          </>
        ) : (
          <>
            <h2 className="text-lg font-bold text-text-primary">パスワードの再設定</h2>
            <p className="text-sm text-text-secondary">
              登録したメールアドレスを入力してください。再設定用のリンクをお送りします。
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
              <button
                type="submit"
                disabled={status === "sending"}
                className="h-12 rounded-full bg-accent text-sm font-bold text-text-primary disabled:opacity-60"
              >
                {status === "sending" ? "送信中…" : "再設定メールを送る"}
              </button>
              <p role="alert" aria-live="assertive" className="text-xs text-[#D8452F]">
                {errorMessage}
              </p>
            </form>
          </>
        )}
        <Link href="/login" className="mt-4 text-xs font-bold text-text-tertiary">
          ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}
