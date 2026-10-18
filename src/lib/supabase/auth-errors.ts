import type { AuthError } from "@supabase/supabase-js";

/** Messages for the `?error=` param that /auth/callback redirects to /login with. */
export const LOGIN_PAGE_ERRORS: Record<string, string> = {
  auth: "ログインに失敗しました。もう一度お試しください。",
  link_expired: "このリンクは期限切れか、すでに使われています。もう一度お試しください。",
};

/** Turns a Supabase AuthError into a Japanese message for the user. */
export function authErrorMessage(error: AuthError, fallback: string): string {
  // Rate limits get their own message: a generic one makes people retry,
  // which only extends the limit.
  if (error.status === 429 || error.code?.startsWith("over_")) {
    return "送信回数の上限に達しました。しばらく時間をおいてからお試しください。";
  }
  if (error.name === "AuthRetryableFetchError") {
    return "接続できませんでした。通信環境を確認して、もう一度お試しください。";
  }
  switch (error.code) {
    case "invalid_credentials":
      return "メールアドレスまたはパスワードが正しくありません。";
    case "email_not_confirmed":
      return "メールアドレスの確認が完了していません。届いた確認メールのリンクを開いてください。";
    case "user_already_exists":
      return "このメールアドレスはすでに登録されています。";
    case "weak_password":
      return "パスワードは6文字以上で設定してください。";
    case "same_password":
      return "今と同じパスワードは使えません。別のパスワードを設定してください。";
    default:
      return fallback;
  }
}
