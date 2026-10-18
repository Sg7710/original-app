import { redirect } from "next/navigation";
import { MeshiApp } from "@/components/meshi/MeshiApp";
import { createClient } from "@/lib/supabase/server";
import { isAuthBypassed } from "@/lib/meshi/dev-mode";

export default async function Home() {
  if (!isAuthBypassed()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect("/login");
  }

  return <MeshiApp />;
}
