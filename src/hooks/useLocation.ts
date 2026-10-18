"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { straightDistance } from "@/lib/meshi/derived";

export type LocationStatus = "idle" | "requesting" | "granted" | "denied" | "error";

export interface Coords {
  lat: number;
  lng: number;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
};

/**
 * Moving less than this doesn't count as moving: GPS jitters by tens of
 * meters, and every new position means a new (paid) store search.
 */
export const MOVE_THRESHOLD_M = 200;

export function useLocation() {
  const [status, setStatus] = useState<LocationStatus>("idle");
  const [coords, setCoords] = useState<Coords | null>(null);
  const coordsRef = useRef<Coords | null>(null);

  const request = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      return;
    }
    setStatus("requesting");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = { lat: position.coords.latitude, lng: position.coords.longitude };
        coordsRef.current = next;
        setCoords(next);
        setStatus("granted");
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "error");
      },
      GEOLOCATION_OPTIONS,
    );
  }, []);

  // 別のアプリから戻ってきたとき、黙って現在地を取り直す。
  // MOVE_THRESHOLD_M 以上動いていたときだけ coords を変える(=探し直しになる)。
  useEffect(() => {
    if (status !== "granted") return;

    function onVisible() {
      if (document.visibilityState !== "visible") return;
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = { lat: position.coords.latitude, lng: position.coords.longitude };
          const prev = coordsRef.current;
          if (prev && straightDistance(prev, next) < MOVE_THRESHOLD_M) return;
          coordsRef.current = next;
          setCoords(next);
        },
        () => {
          // 取れなかったら今の場所のまま使い続ける
        },
        GEOLOCATION_OPTIONS,
      );
    }

    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [status]);

  return { status, coords, request };
}
