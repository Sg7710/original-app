import type { Store } from "@/types/store";
import type { RawPlace } from "./places";

function yen(money: { units?: string } | undefined): string | null {
  const n = Number(money?.units);
  return money?.units && Number.isFinite(n) ? n.toLocaleString("ja-JP") : null;
}

/**
 * "¥1,000〜2,000" from Google's priceRange. Google's priceLevel (¥/¥¥) is a
 * vague label that often disagrees with the range, so it's only a fallback.
 */
function priceLabel(place: RawPlace): string | null {
  const start = yen(place.priceRange?.startPrice);
  const end = yen(place.priceRange?.endPrice);
  if (start && end) return `¥${start}〜${end}`;
  if (start) return `¥${start}〜`;
  if (end) return `〜¥${end}`;
  return mapPriceLevel(place.priceLevel);
}

function priceTier(place: RawPlace): Store["priceTier"] {
  const start = Number(place.priceRange?.startPrice?.units);
  if (!place.priceRange?.startPrice?.units || !Number.isFinite(start)) return null;
  if (start < 2000) return 1;
  if (start < 3000) return 2;
  if (start < 6000) return 3;
  return 4;
}

function mapPriceLevel(level: string | undefined): string | null {
  switch (level) {
    case "PRICE_LEVEL_INEXPENSIVE":
      return "¥";
    case "PRICE_LEVEL_MODERATE":
      return "¥¥";
    case "PRICE_LEVEL_EXPENSIVE":
    case "PRICE_LEVEL_VERY_EXPENSIVE":
      return "¥¥¥";
    default:
      return null;
  }
}

function photoUrlFor(photoName: string): string {
  return `/api/places/photo?name=${encodeURIComponent(photoName)}`;
}

/** Only http(s) links become buttons, so a bad value can never run script. */
function safeWebsite(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const { protocol } = new URL(url);
    return protocol === "http:" || protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
export function mapPlaceToStore(
  place: RawPlace,
  walkMinutes: number | null,
  opensAt: string | null,
): Store | null {
  // Google puts a "cover" shot first, usually the storefront. The 2nd photo was
  // food in 4 of 5 stores we sampled around Fukui Station (2026-10-08), so lead
  // with it and keep the cover right after; the rest follow in Google's order.
  const raw = place.photos ?? [];
  const ordered = raw.length > 1 ? [raw[1], raw[0], ...raw.slice(2)] : raw;
  const photos = ordered.map((p) => ({
    url: photoUrlFor(p.name),
    attribution: p.authorAttributions?.[0]?.displayName ?? "Google",
  }));
  if (photos.length === 0 || !place.location) return null;

  return {
    placeId: place.id,
    name: place.displayName?.text ?? "名称不明",
    genre: place.primaryTypeDisplayName?.text ?? "レストラン",
    price: priceLabel(place),
    priceTier: priceTier(place),
    photoUrl: photos[0].url,
    photoAttribution: photos[0].attribution,
    photos,
    lat: place.location.latitude,
    lng: place.location.longitude,
    walkMinutes,
    opensAt,
    openNow: place.currentOpeningHours?.openNow ?? null,
    closesAt: place.currentOpeningHours?.nextCloseTime ?? null,
    websiteUrl: safeWebsite(place.websiteUri),
  };
}
