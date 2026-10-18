import type { Store } from "@/types/store";

/** List thumbnail with the photo credit Google's terms require, tiny, right under it. */
export function StoreThumb({
  store,
  size,
  radius,
  dimmed = false,
  onOpen,
}: {
  store: Pick<Store, "name" | "photoUrl" | "photoAttribution">;
  size: number;
  radius: number;
  dimmed?: boolean;
  /** 渡すと写真がボタンになり、タップで写真を大きく見る画面を開く。 */
  onOpen?: () => void;
}) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={store.photoUrl}
      alt={store.name}
      className="object-cover"
      style={{ width: size, height: size, borderRadius: radius, opacity: dimmed ? 0.45 : 1 }}
    />
  );
  return (
    <div className="flex shrink-0 flex-col gap-0.5" style={{ width: size }}>
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${store.name}の写真を大きく見る`}
          className="block"
          style={{ borderRadius: radius }}
        >
          {img}
        </button>
      ) : (
        img
      )}
      <p className="truncate text-[9px] leading-tight text-text-tertiary">
        写真: {store.photoAttribution}
      </p>
    </div>
  );
}
