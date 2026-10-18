import type { Store } from "@/types/store";
import { estimateWalkMinutes } from "@/lib/meshi/derived";
import type { RawPlace } from "./places";
import { mapPlaceToStore } from "./map-store";

/**
 * Turns Places results into Stores. With an `origin`, walk minutes are
 * estimated from straight-line distance (no Routes API call — it was ~3/4 of
 * the cost of each search); without one, walkMinutes is null.
 */
export function buildStores(
  places: RawPlace[],
  origin: { lat: number; lng: number } | null,
  opensAtOf: (place: RawPlace) => string | null,
): Store[] {
  return places
    .map((place) => {
      const location = { lat: place.location!.latitude, lng: place.location!.longitude };
      const walkMinutes = origin ? estimateWalkMinutes(origin, location) : null;
      return mapPlaceToStore(place, walkMinutes, opensAtOf(place));
    })
    .filter((store): store is Store => store !== null);
}
