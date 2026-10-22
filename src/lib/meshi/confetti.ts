const CONFETTI_COLORS = ["#F2A93B", "#E8641E", "#3E9E68", "#E2B33A", "#C9432E", "#6F94B8"];

/**
 * お店が決まった瞬間の紙吹雪。box(画面いっぱいの、pointer-events なしの要素)の
 * 上のほう(topPercent)から飛び散らせる。終わったら紙は自分で消える。
 */
export function burstConfetti(box: HTMLElement, topPercent = 34) {
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("span");
    const size = 6 + Math.random() * 6;
    Object.assign(piece.style, {
      position: "absolute",
      left: `${50 + (Math.random() - 0.5) * 20}%`,
      top: `${topPercent}%`,
      width: `${size}px`,
      height: `${size * (0.4 + Math.random() * 0.8)}px`,
      background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      borderRadius: Math.random() < 0.3 ? "50%" : "2px",
    });
    box.appendChild(piece);
    const angle = Math.random() * Math.PI * 2;
    const power = 120 + Math.random() * 180;
    piece
      .animate(
        [
          { transform: "translate(0,0) rotate(0deg)", opacity: 1 },
          {
            transform: `translate(${Math.cos(angle) * power}px, ${Math.sin(angle) * power - 80}px) rotate(${Math.random() * 540}deg)`,
            opacity: 1,
            offset: 0.35,
          },
          {
            transform: `translate(${Math.cos(angle) * power * 1.3}px, ${260 + Math.random() * 200}px) rotate(${Math.random() * 900}deg)`,
            opacity: 0,
          },
        ],
        { duration: 1600 + Math.random() * 900, easing: "cubic-bezier(.2,.7,.4,1)" },
      )
      .finished.then(() => piece.remove());
  }
}

/** 決まった瞬間に、対応しているスマホを軽く振動させる。 */
export function celebrateVibrate() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.([30, 60, 40]);
}

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
