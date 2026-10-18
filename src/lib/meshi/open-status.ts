import type { Store } from "@/types/store";

/** 一覧での並び順と色分けに使う、今の営業状況。 */
export type OpenStatus = "open" | "soon" | "unknown" | "closed";

/** この時間以内に開く店は「まもなく開店」。 */
const OPENS_SOON_MS = 60 * 60 * 1000;

/** 上から 営業中 → まもなく開店 → 営業時間が分からない → 営業時間外 の順に並べる。 */
export const OPEN_STATUS_RANK: Record<OpenStatus, number> = {
  open: 0,
  soon: 1,
  unknown: 2,
  closed: 3,
};

/**
 * 取ってきた時点の営業情報と今の時刻から、今の営業状況を決める。開店・閉店の時刻を
 * 過ぎていれば切り替えるので、Google に取り直さなくても時間とともに正しくなる。
 */
export function openStatus(
  store: Pick<Store, "openNow" | "opensAt" | "closesAt">,
  now: number,
): OpenStatus {
  if (store.openNow === true) {
    const closesAt = store.closesAt ? Date.parse(store.closesAt) : NaN;
    return closesAt <= now ? "closed" : "open";
  }
  if (store.opensAt) {
    const opensAt = Date.parse(store.opensAt);
    if (opensAt <= now) return "open";
    return opensAt - now <= OPENS_SOON_MS ? "soon" : "closed";
  }
  return store.openNow === false ? "closed" : "unknown";
}
