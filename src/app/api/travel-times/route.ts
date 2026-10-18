import { NextResponse } from "next/server";
import type { TravelMode } from "@/hooks/useAccount";
import { computeTravelMinutes } from "@/lib/google/routes";

/** Each destination is one billed element, so keep batches small. */
const MAX_PLACE_IDS = 25;
const PLACE_ID_PATTERN = /^[A-Za-z0-9_-]{10,300}$/;
const MODES: TravelMode[] = ["walk", "bike", "car"];

/**
 * Real-road travel minutes from the current location to stores, for the time
 * shown on cards and lists. Returns { minutes: { [placeId]: number } }; stores
 * Google couldn't route to are left out (the client falls back to its estimate).
 */
export async function POST(request: Request) {
  let body: { origin?: { lat?: unknown; lng?: unknown }; placeIds?: unknown; mode?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid request body" }, { status: 400 });
  }

  const { origin, placeIds, mode } = body;
  if (!origin || typeof origin.lat !== "number" || typeof origin.lng !== "number") {
    return NextResponse.json({ error: "origin is required" }, { status: 400 });
  }
  if (
    !Array.isArray(placeIds) ||
    placeIds.length === 0 ||
    placeIds.length > MAX_PLACE_IDS ||
    !placeIds.every((id) => typeof id === "string" && PLACE_ID_PATTERN.test(id))
  ) {
    return NextResponse.json({ error: "invalid placeIds" }, { status: 400 });
  }
  if (!MODES.includes(mode as TravelMode)) {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  try {
    const byIndex = await computeTravelMinutes(
      { lat: origin.lat, lng: origin.lng },
      placeIds as string[],
      mode as TravelMode,
    );
    const minutes: Record<string, number> = {};
    for (const [i, m] of byIndex) minutes[(placeIds as string[])[i]] = m;
    return NextResponse.json({ minutes });
  } catch (err) {
    console.error("[api/travel-times]", err);
    return NextResponse.json({ error: "failed to compute travel times" }, { status: 502 });
  }
}
