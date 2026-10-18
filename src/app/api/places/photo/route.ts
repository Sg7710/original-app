import { NextResponse } from "next/server";

// 料金は1枚ごとで大きさに関係ないので、スマホの高解像度画面でもぼやけない大きさで取る。
const MAX_WIDTH_PX = 1200;

/**
 * Proxies Places Photo media so the Google API key never reaches the browser.
 * `name` is a photo resource name like "places/ChIJ.../photos/AelY...".
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name");
  if (!name || !name.startsWith("places/")) {
    return NextResponse.json({ error: "invalid photo name" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "server not configured" }, { status: 500 });
  }

  const upstream = await fetch(
    `https://places.googleapis.com/v1/${name}/media?maxWidthPx=${MAX_WIDTH_PX}&key=${apiKey}`,
    { cache: "no-store" },
  );

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "failed to fetch photo" }, { status: 502 });
  }

  return new NextResponse(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
