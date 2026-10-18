
export interface StorePhoto {
  url: string;
  attribution: string;
}

export interface Store {
  placeId: string;
  name: string;
  genre: string;
  /** Display label: "¥1,000〜2,000" when Google has a price range, else "¥"–"¥¥¥", else null. */
  price: string | null;
  /**
   * Price band from the lower end of Google's price range:
   * 1 = under ¥2,000, 2 = ¥2,000s, 3 = ¥3,000–5,999, 4 = ¥6,000+.
   * null when Google only has the vague ¥/¥¥ level (or nothing).
   */
  priceTier: 1 | 2 | 3 | 4 | null;
  photoUrl: string;
  photoAttribution: string;
  /** All photos for the card's tap-through, starting with photoUrl's. */
  photos: StorePhoto[];
  lat: number;
  lng: number;
  /** null when the walk time wasn't computed (e.g. stores re-fetched for the like history). */
  walkMinutes: number | null;
  /** ISO time the store opens next, or null if it's open now. */
  opensAt: string | null;
  /** Open right now, per Google at fetch time; null when Google has no hours. */
  openNow: boolean | null;
  /** ISO time an open store closes next (so lists can mark it closed later); null if unknown. */
  closesAt: string | null;
  /** The store's own homepage (http/https only); null when Google has none. */
  websiteUrl: string | null;
}
