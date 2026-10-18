"use client";

import { useEffect, useState } from "react";
import type { LocationStatus } from "@/hooks/useLocation";
import { useOnboarding } from "@/hooks/useOnboarding";
import { FRAME_CLASS } from "./frame";

interface LocationPermissionProps {
  status: LocationStatus;
  onRequest: () => void;
  /** Returning visitor: skip the explanation and request location right away. */
  autoStart?: boolean;
}

const REQUESTING_HINT_DELAY_MS = 3_000;

export function LocationPermission({
  status,
  onRequest,
  autoStart = false,
}: LocationPermissionProps) {
  const { markSeen } = useOnboarding();
  const [showRequestingHint, setShowRequestingHint] = useState(false);

  // Reset the hint whenever we (re-)enter a different status — done during render
  // (not in an effect) since it's adjusting state in response to a prop change.
  const [hintForStatus, setHintForStatus] = useState(status);
  if (hintForStatus !== status) {
    setHintForStatus(status);
    setShowRequestingHint(false);
  }

  // 設計書 ST-1: 説明画面を表示した時点で「見た」ことにする(許可/拒否の結果は問わない)。
  useEffect(() => {
    markSeen();
  }, [markSeen]);

  useEffect(() => {
    if (autoStart && status === "idle") {
      onRequest();
    }
    // onRequest is stable (useCallback in useLocation); only re-run when status flips back to idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, status]);

  useEffect(() => {
    if (status !== "requesting") return;
    const timer = window.setTimeout(() => setShowRequestingHint(true), REQUESTING_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  const content = (() => {
    if (status === "idle" && autoStart) {
      return { title: " ", body: undefined as string | undefined, actionLabel: undefined as string | undefined };
    }
    switch (status) {
      case "requesting":
        return {
          title: showRequestingHint ? "現在地を取得しています…" : " ",
          body: undefined,
          actionLabel: undefined,
        };
      case "denied":
        return {
          title: "現在地の許可が必要です",
          body: "ブラウザのアドレスバー付近にある設定アイコンから、このサイトの位置情報を「許可」に変更してから再試行してください。",
          actionLabel: "再試行",
        };
      case "error":
        return {
          title: "現在地を取得できませんでした",
          body: "電波状況などにより取得に失敗しました。もう一度お試しください。",
          actionLabel: "再試行",
        };
      case "idle":
      default:
        return {
          title: "近くのお店を探すために現在地を使います",
          body: "許可すると、現在地から歩ける範囲の営業中のお店を表示します。位置情報は、近くのお店を探すためだけに使います（検索にはGoogleのサービスを使います）。位置情報を保存することはありません。",
          actionLabel: "現在地を許可する",
        };
    }
  })();

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-lg font-bold text-text-primary">{content.title}</h2>
        {content.body && <p className="text-sm text-text-secondary">{content.body}</p>}
        {content.actionLabel && (
          <button
            type="button"
            onClick={onRequest}
            className="mt-4 h-12 rounded-full bg-accent px-6 text-sm font-bold text-text-primary"
          >
            {content.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
