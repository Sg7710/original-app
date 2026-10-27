import { straightDistance } from "@/lib/meshi/derived";

const PLACE_FIELDS = [
  "id",
  "displayName",
  "primaryType",
  "primaryTypeDisplayName",
  "priceLevel",
  "priceRange",
  "photos",
  "location",
  // 公式ホームページ。値段・営業時間と同じEnterprise区分なので、足しても料金は変わらない。
  "websiteUri",
];
const SEARCH_FIELD_MASK = [
  ...PLACE_FIELDS,
  "currentOpeningHours.openNow",
  "currentOpeningHours.nextOpenTime",
  "currentOpeningHours.nextCloseTime",
]
  .map((f) => `places.${f}`)
  .join(",");
// 食べたいリストの「営業中だけ」用に営業中かどうかも取る(値段と同じ料金区分の項目)。
const DETAILS_FIELD_MASK = [
  ...PLACE_FIELDS,
  "currentOpeningHours.openNow",
  "currentOpeningHours.nextOpenTime",
  "currentOpeningHours.nextCloseTime",
].join(",");

/** Stores that open within this window are shown after the open ones, labelled with the time. */
const OPENS_SOON_MS = 30 * 60 * 1000;

/**
 * Places whose *primary* type is one of these get returned for `restaurant`
 * only because they contain one (a hotel with a restaurant, a shopping mall).
 */
const NON_RESTAURANT_PRIMARY_TYPES = new Set([
  "lodging",
  "hotel",
  "resort_hotel",
  "shopping_mall",
  "department_store",
  "train_station",
  "transit_station",
  "subway_station",
  "bus_station",
  "airport",
  "tourist_attraction",
  "wedding_venue",
  "event_venue",
  "golf_course",
  "amusement_park",
]);

interface GoogleMoney {
  currencyCode?: string;
  units?: string;
}

export interface RawPlace {
  id: string;
  displayName?: { text: string };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  priceLevel?: string;
  priceRange?: { startPrice?: GoogleMoney; endPrice?: GoogleMoney };
  photos?: Array<{
    name: string;
    authorAttributions?: Array<{ displayName: string }>;
  }>;
  location?: { latitude: number; longitude: number };
  currentOpeningHours?: { openNow?: boolean; nextOpenTime?: string; nextCloseTime?: string };
  websiteUri?: string;
}

function getApiKey(): string {
  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_SERVER_API_KEY is not set");
  }
  return apiKey;
}

function isUsable(place: RawPlace): boolean {
  return (
    (place.photos?.length ?? 0) > 0 &&
    place.location != null &&
    !NON_RESTAURANT_PRIMARY_TYPES.has(place.primaryType ?? "")
  );
}

/** null = open now, ISO string = opens within OPENS_SOON_MS, undefined = neither (drop it). */
export function opensAtFor(place: RawPlace, now: number = Date.now()): string | null | undefined {
  const hours = place.currentOpeningHours;
  if (hours?.openNow === true) return null;
  const next = hours?.nextOpenTime;
  if (next && Date.parse(next) - now <= OPENS_SOON_MS) return next;
  return undefined;
}

/** searchNearby / searchText return at most this many places per call. */
const MAX_RESULTS = 20;

/**
 * Places API (New) searchNearby. Returns only restaurants that are open now or
 * open within the hour, have at least one photo, and aren't hotels/malls —
 * everything else is filtered out here so downstream code (Routes lookup,
 * Store mapping) never sees an unusable place.
 *
 * Google returns the 20 most popular places in the circle, not all of them.
 * `saturated` = it hit that cap, so there are more places than we got.
 */
export async function searchNearbyRestaurants(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<{ places: RawPlace[]; saturated: boolean }> {
  const apiKey = getApiKey();

  const res = await fetch("https://places.googleapis.com/v1/places:searchNearby", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": SEARCH_FIELD_MASK,
    },
    body: JSON.stringify({
      includedTypes: ["restaurant"],
      maxResultCount: MAX_RESULTS,
      languageCode: "ja",
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: radiusMeters,
        },
      },
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Places API error: ${res.status}`);
  }

  const data = (await res.json()) as { places?: RawPlace[] };
  const places = data.places ?? [];

  const now = Date.now();
  return {
    places: places.filter((place) => isUsable(place) && opensAtFor(place, now) !== undefined),
    saturated: places.length >= MAX_RESULTS,
  };
}

/** Rough meters per degree, for the search rectangle around the circle. */
const METERS_PER_DEGREE_LAT = 111_320;

/**
 * Places API (New) searchText with openNow: up to 20 restaurants *open right now*,
 * nearest first, so closed places can't use up the 20-result cap the way they do
 * in searchNearby. Text Search only takes a rectangle, so places outside the
 * circle are dropped here. Pass the previous call's `nextPageToken` for the next
 * 20 (the rest of the request must stay the same).
 */
export async function searchOpenRestaurantsByText(
  lat: number,
  lng: number,
  radiusMeters: number,
  pageToken?: string,
): Promise<{ places: RawPlace[]; nextPageToken?: string }> {
  const apiKey = getApiKey();
  const dLat = radiusMeters / METERS_PER_DEGREE_LAT;
  const dLng = radiusMeters / (METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180));

  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": `${SEARCH_FIELD_MASK},nextPageToken`,
    },
    body: JSON.stringify({
      textQuery: "レストラン",
      includedType: "restaurant",
      strictTypeFiltering: true,
      openNow: true,
      pageSize: MAX_RESULTS,
      rankPreference: "DISTANCE",
      languageCode: "ja",
      locationRestriction: {
        rectangle: {
          low: { latitude: lat - dLat, longitude: lng - dLng },
          high: { latitude: lat + dLat, longitude: lng + dLng },
        },
      },
      ...(pageToken ? { pageToken } : {}),
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Places API (text) error: ${res.status}`);
  }

  const data = (await res.json()) as { places?: RawPlace[]; nextPageToken?: string };
  const now = Date.now();
  const places = (data.places ?? []).filter(
    (place) =>
      isUsable(place) &&
      opensAtFor(place, now) !== undefined &&
      straightDistance(
        { lat, lng },
        { lat: place.location!.latitude, lng: place.location!.longitude },
      ) <= radiusMeters,
  );
  return { places, nextPageToken: data.nextPageToken };
}

/**
 * Places API (New) Place Details, for stores saved in the favorites / like
 * history that aren't in the current search. Google's terms only allow us to
 * keep place IDs, so the rest has to be fetched again. Places that no longer
 * exist (or can't be shown) come back as null.
 */
export async function getPlaceDetails(placeId: string): Promise<RawPlace | null> {
  const apiKey = getApiKey();
  const res = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=ja`,
    {
      headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": DETAILS_FIELD_MASK },
      cache: "no-store",
    },
  );
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) {
    throw new Error(`Places API error: ${res.status}`);
  }
  const place = (await res.json()) as RawPlace;
  return place.photos?.length && place.location ? place : null;
}
