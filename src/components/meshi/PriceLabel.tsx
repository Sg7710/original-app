import type { Store } from "@/types/store";
import { priceTierColor } from "@/lib/meshi/derived";

/** Price text for list rows, with a dot in the price band's color. */
export function PriceLabel({ store }: { store: Pick<Store, "price" | "priceTier"> }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: priceTierColor(store.priceTier) }}
      />
      {store.price ?? "?"}
    </span>
  );
}
