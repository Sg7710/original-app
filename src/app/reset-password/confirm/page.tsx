import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FRAME_CLASS } from "@/components/meshi/frame";
import { NewPasswordForm } from "./NewPasswordForm";

export default async function ResetPasswordConfirmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /auth/callback signs the user in from the email link before sending them
  // here. No session means the link was never opened, or it expired.
  if (!user) {
    return (
      <div className={FRAME_CLASS}>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
          <h2 className="text-lg font-bold text-text-primary">リンクが無効です</h2>
          <p className="text-sm text-text-secondary">
            このリンクは期限切れか、すでに使われています。もう一度、再設定メールを送ってください。
          </p>
          <Link
            href="/reset-password"
            className="mt-4 flex h-12 w-full max-w-[280px] items-center justify-center rounded-full bg-accent text-sm font-bold text-text-primary"
          >
            再設定メールを送り直す
          </Link>
          <Link href="/login" className="mt-4 text-xs font-bold text-text-tertiary">
            ログイン画面に戻る
          </Link>
        </div>
      </div>
    );
  }

  return <NewPasswordForm />;
}
