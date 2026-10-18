import { NextResponse } from "next/server";
import {
  opensAtFor,
  searchNearbyRestaurants,
  searchOpenRestaurantsByText,
  type RawPlace,
} from "@/lib/google/places";
import { buildStores } from "@/lib/google/build-stores";
import { recordStoresWithoutWebsite } from "@/lib/meshi/no-website";

const DEFAULT_RADIUS_M = 1500;
const EXPANDED_RADIUS_M = 3000;
const ALLOWED_RADII = new Set([DEFAULT_RADIUS_M, EXPANDED_RADIUS_M, 5000]);

/**
 * 追加の「営業中だけ」検索(Text Search)は、お金がかかるので必要なときだけ:
 * 範囲が広く(1.5kmより上)、最初の検索が20件の上限に達していて(=取りこぼしがある)、
 * それでも使える営業中の店がこれより少ないとき。
 */
const ENOUGH_OPEN_STORES = 15;
/** 営業中の店がこれだけ集まったら、次のページは取らない。 */
const TARGET_OPEN_STORES = 20;
const MAX_TEXT_PAGES = 3;

function openCount(places: RawPlace[]): number {
  return places.filter((p) => p.currentOpeningHours?.openNow === true).length;
}

/** 営業中の店を「営業中だけ」の検索で足す。失敗しても最初の検索結果はそのまま使う。 */
async function addOpenStores(
  places: RawPlace[],
  lat: number,
  lng: number,
  radius: number,
): Promise<RawPlace[]> {
  const merged = new Map(places.map((p) => [p.id, p]));
  let pageToken: string | undefined;
  let pages = 0;
  try {
    do {
      const page = await searchOpenRestaurantsByText(lat, lng, radius, pageToken);
      pages += 1;
      for (const p of page.places) if (!merged.has(p.id)) merged.set(p.id, p);
      pageToken = page.nextPageToken;
    } while (
      pageToken &&
      pages < MAX_TEXT_PAGES &&
      openCount([...merged.values()]) < TARGET_OPEN_STORES
    );
  } catch (err) {
    console.error("[api/stores] open-now search failed", err);
  }
  console.info(
    `[api/stores] open-now search: ${pages} page(s), ${merged.size - places.length} added`,
  );
  return [...merged.values()];
}

export async function POST(request: Request) {
  let body: { lat?: number; lng?: number; radius?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { lat, lng, radius = DEFAULT_RADIUS_M } = body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat/lng is required" }, { status: 400 });
  }
  if (!ALLOWED_RADII.has(radius)) {
    return NextResponse.json({ error: "unsupported radius" }, { status: 400 });
  }

  try {
    let usedRadius = radius;
    let { places, saturated } = await searchNearbyRestaurants(lat, lng, usedRadius);
    // Nothing usable nearby (suburbs, late night): widen once automatically.
    if (places.length === 0 && usedRadius === DEFAULT_RADIUS_M) {
      usedRadius = EXPANDED_RADIUS_M;
      ({ places, saturated } = await searchNearbyRestaurants(lat, lng, usedRadius));
    }
    if (usedRadius > DEFAULT_RADIUS_M && saturated && openCount(places) < ENOUGH_OPEN_STORES) {
      places = await addOpenStores(places, lat, lng, usedRadius);
    }

    const now = Date.now();
    const stores = buildStores(places, { lat, lng }, (place) => opensAtFor(place, now) ?? null);
    recordStoresWithoutWebsite(stores);
    return NextResponse.json({ stores, radius: usedRadius });
  } catch (err) {
    console.error("[api/stores]", err);
    return NextResponse.json({ error: "failed to fetch stores" }, { status: 502 });
  }
}
