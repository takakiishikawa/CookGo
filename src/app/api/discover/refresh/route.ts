import { NextResponse } from "next/server";
import { refreshDiscoverFeed } from "@/lib/discover-refresh";
import { DISCOVER_TAB_IDS, type DiscoverTabId } from "@/types/database";

export const maxDuration = 300;

function isDiscoverTabId(v: string | null): v is DiscoverTabId {
  return !!v && (DISCOVER_TAB_IDS as readonly string[]).includes(v);
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");

  // Dev-only bypass: no CRON_SECRET configured locally and not production.
  const devBypass = !cronSecret && process.env.NODE_ENV !== "production";
  if (!devBypass) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const url = new URL(request.url);
  const tabParam = url.searchParams.get("tab");
  if (tabParam && !isDiscoverTabId(tabParam)) {
    return NextResponse.json({ error: "invalid tab" }, { status: 400 });
  }

  try {
    const result = await refreshDiscoverFeed(
      tabParam && isDiscoverTabId(tabParam) ? tabParam : undefined,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("discover refresh error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `Discover の更新に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
