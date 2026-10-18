import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isAuthBypassed } from "@/lib/meshi/dev-mode";
import { SignupForm } from "./SignupForm";

export default async function SignupPage() {
  if (!isAuthBypassed()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/");
  }

  return <SignupForm />;
}
