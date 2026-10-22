import { NextResponse } from "next/server";
import { getPlaceDetails, type RawPlace } from "@/lib/google/places";
import { buildStores } from "@/lib/google/build-stores";
import { createClient } from "@/lib/supabase/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** 終わった投票も結果を見に来る人がいるので、終わってから1日は候補の情報を返す。 */
const AFTER_CLOSE_MS = 24 * 60 * 60 * 1000;

/**
 * 投票ページ用: その投票の候補(最大6軒)のお店を Google から取り直して返す。
 * 友達はログインなしで使う(src/lib/supabase/proxy.ts で公開)ので、誰でも好きな店を
 * 取れる窓口にならないよう、投票IDから候補を決め、終わって1日たった投票には返さない。
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_poll", { poll_id: id });
  if (error) {
    console.error("[api/polls/stores] get_poll", error);
    return NextResponse.json({ error: "failed to load poll" }, { status: 502 });
  }
  const poll = (
    data as { place_ids: string[]; closes_at: string; closed_at: string | null }[]
  )?.[0];
  if (!poll) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const endedAt = Math.min(
    Date.parse(poll.closes_at),
    poll.closed_at ? Date.parse(poll.closed_at) : Infinity,
  );
  if (Date.now() > endedAt + AFTER_CLOSE_MS) {
    return NextResponse.json({ error: "poll expired" }, { status: 410 });
  }

  try {
    const places = (await Promise.all(poll.place_ids.map((pid) => getPlaceDetails(pid)))).filter(
      (place): place is RawPlace => place !== null,
    );
    // 友達の現在地は使わないので徒歩時間はなし。閉まっている店は次に開く時刻を持たせる。
    const stores = buildStores(places, null, (place) =>
      place.currentOpeningHours?.openNow === false
        ? (place.currentOpeningHours.nextOpenTime ?? null)
        : null,
    );
    // 候補として選ばれた順に並べる
    stores.sort((a, b) => poll.place_ids.indexOf(a.placeId) - poll.place_ids.indexOf(b.placeId));
    return NextResponse.json({ stores });
  } catch (err) {
    console.error("[api/polls/stores]", err);
    return NextResponse.json({ error: "failed to fetch stores" }, { status: 502 });
  }
}
