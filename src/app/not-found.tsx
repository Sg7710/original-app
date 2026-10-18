import Link from "next/link";
import { FRAME_CLASS } from "@/components/meshi/frame";

export default function NotFound() {
  return (
    <div className={FRAME_CLASS}>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <p className="font-mono text-xs text-text-tertiary">404</p>
        <h2 className="text-lg font-bold text-text-primary">ページが見つかりません</h2>
        <p className="text-sm text-text-secondary">
          URLが間違っているか、ページが移動した可能性があります。
        </p>
        <Link
          href="/"
          className="mt-4 flex h-12 w-full max-w-[280px] items-center justify-center rounded-full bg-accent text-sm font-bold text-text-primary"
        >
          トップに戻る
        </Link>
      </div>
    </div>
  );
}
