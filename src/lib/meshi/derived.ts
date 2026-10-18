import type { TravelMode } from "@/hooks/useAccount";

export function distText(meters: number): string {
  return meters >= 1000 ? `約${(meters / 1000).toFixed(1)}km` : `約${Math.round(meters)}m`;
}

const TRAVEL_LABEL: Record<TravelMode, string> = { walk: "徒歩", bike: "自転車", car: "車" };

/**
 * 移動の速さ(m/分)。どれも Routes API を使わない目安。徒歩は不動産表示と同じ80m/分、
 * 自転車は時速15km、車は信号や混み具合を見込んだ街中の時速24km。
 */
const TRAVEL_METERS_PER_MINUTE: Record<TravelMode, number> = { walk: 80, bike: 250, car: 400 };

/** "約1時間5分" / "約12分" / "約2時間". */
export function durationText(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `約${m}分`;
  return m === 0 ? `約${h}時間` : `約${h}時間${m}分`;
}

/**
 * "徒歩約12分" / "自転車約4分" / "車約1時間5分". Stores only carry walk minutes
 * (estimated from straight-line distance, see estimateWalkMinutes), so other
 * modes are scaled from them by speed.
 */
/** "車約1時間5分" from minutes already in that mode (e.g. Google's route time). */
export function travelLabel(minutes: number, mode: TravelMode): string {
  return `${TRAVEL_LABEL[mode]}${durationText(minutes)}`;
}

export function travelText(walkMinutes: number | null, mode: TravelMode): string {
  const label = TRAVEL_LABEL[mode];
  if (walkMinutes === null) return `${label}—`;
  const minutes = Math.max(
    1,
    Math.round((walkMinutes * TRAVEL_METERS_PER_MINUTE.walk) / TRAVEL_METERS_PER_MINUTE[mode]),
  );
  return `${label}${durationText(minutes)}`;
}

/** Badge colors per price band (green → red = cheap → expensive). Gray when unknown. */
export const PRICE_TIER_COLORS: Record<1 | 2 | 3 | 4, { bg: string; fg: string }> = {
  1: { bg: "#3E9E68", fg: "#FFFFFF" },
  2: { bg: "#E2B33A", fg: "#1A1813" },
  3: { bg: "#E5782E", fg: "#FFFFFF" },
  4: { bg: "#C9432E", fg: "#FFFFFF" },
};
export const PRICE_UNKNOWN_COLOR = "#A39C8C";

export function priceTierColor(tier: 1 | 2 | 3 | 4 | null): string {
  return tier ? PRICE_TIER_COLORS[tier].bg : PRICE_UNKNOWN_COLOR;
}

/** "17:30開店" for a store that opens later, using the device's local time. */
export function opensAtText(opensAt: string): string {
  const d = new Date(opensAt);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}開店`;
}

const GOOGLE_TRAVEL_MODE: Record<TravelMode, string> = {
  walk: "walking",
  bike: "bicycling",
  car: "driving",
};

/** Google Maps directions from the current location to the store. No API key needed. */
export function directionsUrl(
  store: { placeId: string; lat: number; lng: number },
  mode: TravelMode = "walk",
): string {
  const params = new URLSearchParams({
    api: "1",
    destination: `${store.lat},${store.lng}`,
    destination_place_id: store.placeId,
    travelmode: GOOGLE_TRAVEL_MODE[mode],
  });
  return `https://www.google.com/maps/dir/?${params}`;
}

/** Placeholder store IDs used by MOCK_STORES. */
export function isMockPlaceId(placeId: string): boolean {
  return placeId.startsWith("mock-");
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Haversine straight-line distance in meters. */
export function straightDistance(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_M * c;
}

/**
 * Swipe order: stores open now first (shuffled), then stores that open soon,
 * earliest opening first.
 */
export function orderForDeck<T extends { opensAt: string | null }>(stores: T[]): T[] {
  const openNow = shuffle(stores.filter((s) => s.opensAt === null));
  const opensSoon = stores
    .filter((s) => s.opensAt !== null)
    .sort((a, b) => Date.parse(a.opensAt!) - Date.parse(b.opensAt!));
  return [...openNow, ...opensSoon];
}

/** Fisher-Yates shuffle. Returns a new array; does not mutate the input. */
export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Streets aren't straight lines: typical walking routes are ~1.3x the crow-flies distance. */
const DETOUR_FACTOR = 1.3;
const WALK_METERS_PER_MINUTE = 80;

/** Walk minutes estimated from straight-line distance, without calling the Routes API. */
export function estimateWalkMinutes(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const meters = straightDistance(from, to) * DETOUR_FACTOR;
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MINUTE));
}
