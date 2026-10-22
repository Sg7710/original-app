import { PollPage } from "@/components/meshi/PollPage";

/** 投票ページ。友達はログインなしで開く(src/lib/supabase/proxy.ts で /poll を公開)。 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PollPage id={id} />;
}
