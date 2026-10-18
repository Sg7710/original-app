import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/types/store";

/**
 * Google にホームページが登録されていなかったお店の place ID を Supabase の
 * no_website_places に記録する(supabase/schema.sql)。Google の規約で保存してよいのは
 * place ID だけなので、店名や電話番号は保存しない。
 *
 * レスポンスを返したあとに実行するので、お店の表示は遅くならない。記録できなくても
 * (ログインしていない・テーブル未作成など)アプリの動きには影響させない。
 */
export function recordStoresWithoutWebsite(stores: Store[]) {
  const rows = stores.filter((s) => !s.websiteUrl).map((s) => ({ place_id: s.placeId }));
  if (rows.length === 0) return;

  after(async () => {
    try {
      const supabase = await createClient();
      const { error } = await supabase
        .from("no_website_places")
        .upsert(rows, { onConflict: "place_id", ignoreDuplicates: true });
      if (error) console.warn("[no-website] not recorded:", error.message);
    } catch (err) {
      console.warn("[no-website] not recorded:", err);
    }
  });
}
