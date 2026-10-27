import type { Store, StorePhoto } from "@/types/store";

/**
 * 使い方の練習(チュートリアル)で使う、本物ではないお店。写真は食べ物のイラスト(SVG)を
 * アプリの中で作るので、Google の料金はかからない。place ID は "mock-" で始めて、
 * 経路時間などの問い合わせが飛ばないようにする(isMockPlaceId)。
 */

/** やわらかい背景色の上に、大きな食べ物の絵文字をのせたイラスト。 */
function illustration(emoji: string, from: string, to: string, caption: string): StorePhoto {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="800" height="1000" fill="url(#g)"/>
  <circle cx="400" cy="470" r="250" fill="#ffffff" opacity="0.55"/>
  <text x="400" y="560" font-size="300" text-anchor="middle">${emoji}</text>
  <text x="400" y="860" font-size="54" font-weight="700" fill="#5b4632" opacity="0.7" text-anchor="middle" font-family="sans-serif">${caption}</text>
</svg>`;
  return {
    url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    attribution: "イラスト",
  };
}

function practiceStore(
  id: string,
  name: string,
  genre: string,
  price: string,
  priceTier: Store["priceTier"],
  walkMinutes: number,
  photos: StorePhoto[],
): Store {
  return {
    placeId: `mock-practice-${id}`,
    name,
    genre,
    price,
    priceTier,
    photoUrl: photos[0].url,
    photoAttribution: photos[0].attribution,
    photos,
    lat: 0,
    lng: 0,
    walkMinutes,
    opensAt: null,
    openNow: true,
    closesAt: null,
    websiteUrl: null,
  };
}

/** 1枚目: 右にスワイプ(食べたい)する練習。あとで「食べたい」に入って見える。 */
export const PRACTICE_LIKE = practiceStore(
  "ramen",
  "【練習】らーめん さんぷる",
  "ラーメン",
  "¥1,000〜2,000",
  1,
  4,
  [illustration("🍜", "#FFE7C2", "#FFC98A", "練習用のイラストです")],
);

/** 2枚目: 左にスワイプ(パス)する練習。 */
export const PRACTICE_PASS = practiceStore(
  "sushi",
  "【練習】すし さんぷる",
  "寿司",
  "¥3,000〜4,000",
  3,
  7,
  [illustration("🍣", "#E3F1FF", "#B9DBFF", "練習用のイラストです")],
);

/** 3枚目: 写真をタップしてめくる練習(3枚)。 */
export const PRACTICE_PHOTOS = practiceStore(
  "curry",
  "【練習】かれー さんぷる",
  "カレー",
  "¥1,000〜2,000",
  1,
  5,
  [
    illustration("🍛", "#FFF1CC", "#FFD66B", "写真 1/3"),
    illustration("🥗", "#E6F7DF", "#B8E6A5", "写真 2/3"),
    illustration("🍰", "#FDE4EC", "#F7B8CB", "写真 3/3"),
  ],
);
