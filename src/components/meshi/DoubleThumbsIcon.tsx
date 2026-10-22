/** 👍 の形(カードの「食べたい」ボタンと同じ)。24×24 の中に描く。 */
const THUMB_PATH =
  "M2 21h3.5V9.5H2V21zM22 10.6c0-1.1-.9-2-2-2h-6.1l.9-4.4.03-.32c0-.42-.17-.8-.44-1.07L13.3 1.75 7.2 7.86c-.36.36-.58.86-.58 1.41V19c0 1.1.9 2 2 2h8.6c.8 0 1.5-.48 1.8-1.2l2.9-6.9c.1-.23.13-.47.13-.73v-1.57z";

/**
 * 「みんなでスワイプ」のマーク: 👍 を2つ、奥と手前に少し重ねる。手前は文字と同じ色、
 * 奥は少し小さく右上にずらして薄く。重なるところは、手前の周りに背景色(gapColor)のふちを
 * 付けてくっきり分ける。
 */
export function DoubleThumbsIcon({
  size = 26,
  gapColor,
}: {
  size?: number;
  /** ボタンの背景色。手前の👍の周りのふちに使う */
  gapColor: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="currentColor"
      className="shrink-0"
    >
      {/* 奥: 小さく・右上・薄く */}
      <g transform="translate(13 1) scale(0.72)" opacity={0.5}>
        <path d={THUMB_PATH} />
      </g>
      {/* 手前: ふち(背景色)を先に太めに描いてから本体 */}
      <g transform="translate(1 9) scale(0.92)">
        <path
          d={THUMB_PATH}
          stroke={gapColor}
          strokeWidth={3.2}
          strokeLinejoin="round"
          paintOrder="stroke"
        />
      </g>
    </svg>
  );
}
