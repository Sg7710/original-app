import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthBypassed } from "@/lib/meshi/dev-mode";
import { LOGIN_PAGE_ERRORS } from "@/lib/supabase/auth-errors";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reset?: string }>;
}) {
  if (!isAuthBypassed()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/");
  }

  const { error, reset } = await searchParams;
  return (
    <LoginForm
      initialError={error ? (LOGIN_PAGE_ERRORS[error] ?? LOGIN_PAGE_ERRORS.auth) : null}
      notice={reset === "done" ? "パスワードを変更しました。新しいパスワードでログインしてください。" : null}
    />
  );
}
