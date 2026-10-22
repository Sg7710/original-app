import type { Metadata, Viewport } from "next";
import { Zen_Kaku_Gothic_New, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const zenKaku = Zen_Kaku_Gothic_New({
  variable: "--font-zen-kaku",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "直観メシ",
  description: "写真を1枚ずつ見て、右スワイプで「食べたい」に溜める。",
};

// viewportFit: "cover" で画面の端まで使い、ノッチやホームバーの分は FRAME_CLASS の
// safe-area の余白でよける(iPhone)。2本指の拡大はそのまま使えるようにしておく。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fbfaf7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ja"
      className={`${zenKaku.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col items-center justify-center bg-outer font-sans">
        {children}
      </body>
    </html>
  );
}
