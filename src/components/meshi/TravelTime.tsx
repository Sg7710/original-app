"use client";

import type { Store } from "@/types/store";
import { useAccount } from "@/hooks/useAccount";
import { useTravelMinutes } from "@/hooks/useTravelTime";
import { travelLabel, travelText } from "@/lib/meshi/derived";

/**
 * "徒歩約12分" / "車約1時間5分" for a store, in the travel mode from settings.
 * Uses Google's real-road time once it arrives; until then (or if Google can't
 * route it) shows the straight-line estimate.
 */
export function TravelTime({ store }: { store: Pick<Store, "placeId" | "walkMinutes"> }) {
  const { travelMode } = useAccount().settings;
  const routed = useTravelMinutes(store.placeId, travelMode);
  return (
    <>
      {typeof routed === "number"
        ? travelLabel(routed, travelMode)
        : travelText(store.walkMinutes, travelMode)}
    </>
  );
}
