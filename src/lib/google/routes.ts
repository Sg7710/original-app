import type { TravelMode } from "@/hooks/useAccount";

interface RouteMatrixElement {
  destinationIndex: number;
  duration?: string; // e.g. "634s"
  distanceMeters?: number;
  condition?: string; // "ROUTE_EXISTS" | "ROUTE_NOT_FOUND" | ...
}

/**
 * Google Maps has almost no cycling routes in Japan, so bike times come from the
 * walking route's length at this speed (15 km/h).
 */
const BIKE_METERS_PER_MINUTE = 250;

/**
 * Routes API computeRouteMatrix from one origin (current location) to many stores,
 * by real roads. Billed per destination at the Essentials rate (10,000 free a
 * month): driving is TRAFFIC_UNAWARE because traffic-aware routing is the pricier
 * Pro SKU. Returns minutes keyed by index in `placeIds`; stores Google couldn't
 * route to are absent.
 */
export async function computeTravelMinutes(
  origin: { lat: number; lng: number },
  placeIds: string[],
  mode: TravelMode,
): Promise<Map<number, number>> {
  const result = new Map<number, number>();
  if (placeIds.length === 0) return result;

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not set");
  }

  const res = await fetch("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition",
    },
    body: JSON.stringify({
      origins: [
        { waypoint: { location: { latLng: { latitude: origin.lat, longitude: origin.lng } } } },
      ],
      destinations: placeIds.map((placeId) => ({ waypoint: { placeId } })),
      travelMode: mode === "car" ? "DRIVE" : "WALK",
      ...(mode === "car" ? { routingPreference: "TRAFFIC_UNAWARE" } : {}),
      languageCode: "ja",
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Routes API error: ${res.status}`);
  }

  const elements = (await res.json()) as RouteMatrixElement[];
  for (const el of elements) {
    if (el.condition !== "ROUTE_EXISTS") continue;
    if (mode === "bike") {
      if (el.distanceMeters == null) continue;
      result.set(
        el.destinationIndex,
        Math.max(1, Math.round(el.distanceMeters / BIKE_METERS_PER_MINUTE)),
      );
    } else {
      if (!el.duration) continue;
      const seconds = Number(el.duration.replace("s", ""));
      result.set(el.destinationIndex, Math.max(1, Math.round(seconds / 60)));
    }
  }
  return result;
}
