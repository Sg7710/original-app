import { NextResponse } from "next/server";
import { getPlaceDetails, type RawPlace } from "@/lib/google/places";
import { buildStores } from "@/lib/google/build-stores";
import { recordStoresWithoutWebsite } from "@/lib/meshi/no-website";

/** The like history shows at most 30 stores, so no caller needs more. */
const MAX_PLACE_IDS = 30;
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;

/**
 * Re-fetches stores by place ID for the favorites list and like history.
 * With `origin`, walk minutes are computed too; without it they're null.
 */
export async function POST(request: Request) {
  let body: { placeIds?: unknown; origin?: { lat?: number; lng?: number } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { placeIds, origin } = body;
  if (
    !Array.isArray(placeIds) ||
    placeIds.length > MAX_PLACE_IDS ||
    !placeIds.every((id) => typeof id === "string" && PLACE_ID_PATTERN.test(id))
  ) {
    return NextResponse.json({ error: "invalid placeIds" }, { status: 400 });
  }
  const validOrigin =
    origin && typeof origin.lat === "number" && typeof origin.lng === "number"
      ? { lat: origin.lat, lng: origin.lng }
      : null;

  try {
    const places = (await Promise.all(placeIds.map((id) => getPlaceDetails(id)))).filter(
      (place): place is RawPlace => place !== null,
    );
    // Closed stores keep their next opening time; open (or unknown) ones get null.
    const stores = buildStores(places, validOrigin, (place) =>
      place.currentOpeningHours?.openNow === false
        ? (place.currentOpeningHours.nextOpenTime ?? null)
        : null,
    );
    recordStoresWithoutWebsite(stores);
    return NextResponse.json({ stores });
  } catch (err) {
    console.error("[api/stores/lookup]", err);
    return NextResponse.json({ error: "failed to fetch stores" }, { status: 502 });
  }
}
