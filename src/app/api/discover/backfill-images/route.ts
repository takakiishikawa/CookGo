import { NextResponse } from "next/server";
import { backfillMissingDiscoverImages } from "@/lib/discover-refresh";

export const maxDuration = 300;

/**
 * 一回限りのメンテナンス用エンドポイント。既存 discover_items のうち
 * image_url が null の行だけ新しいサムネイル取得ロジックで埋める。
 * /api/discover/refresh と同じ CRON_SECRET 認証を流用。
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  const devBypass = !cronSecret && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await backfillMissingDiscoverImages();
    return NextResponse.json(result);
  } catch (error) {
    console.error("discover backfill-images error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `バックフィルに失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
