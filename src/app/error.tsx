"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FRAME_CLASS } from "@/components/meshi/frame";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <h2 className="text-lg font-bold text-text-primary">エラーが発生しました</h2>
        <p className="text-sm text-text-secondary">
          うまく表示できませんでした。もう一度お試しください。
        </p>
        <button
          type="button"
          onClick={() => retry()}
          className="mt-4 h-12 w-full max-w-[280px] rounded-full bg-accent text-sm font-bold text-text-primary"
        >
          もう一度試す
        </button>
        <Link href="/login" className="mt-4 text-xs font-bold text-text-tertiary">
          ログイン画面に戻る
        </Link>
      </div>
    </div>
  );
}
