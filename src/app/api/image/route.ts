import { NextResponse } from "next/server";
import { fetchUnsplashImage } from "@/lib/unsplash";
import type { ImageResponse } from "@/types/api";

const CACHE: Record<string, { url: string; expires: number }> = {};
const TTL_MS = 86_400_000; // 1 day

async function fetchWikipediaImage(query: string): Promise<string | null> {
  // Try Japanese first, then English
  for (const lang of ["ja", "en"]) {
    try {
      const res = await fetch(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        { next: { revalidate: 86400 } },
      );
      if (!res.ok) continue;
      const data = (await res.json()) as { thumbnail?: { source?: string } };
      if (data.thumbnail?.source) return data.thumbnail.source;
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * `黒胡椒（サラダ用）` `Olive oil (for salad)` のような括弧サフィックスを除去する。
 * これらが Unsplash クエリに残ると 0 件ヒットになるため、検索前に必ず外す。
 */
function stripParenSuffix(s: string): string {
  return s
    .replace(/[（(][^（()）]*[)）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("query")?.trim();
  if (!rawQuery)
    return NextResponse.json({ imageUrl: null } satisfies ImageResponse);

  // ベースクエリ（括弧除去後）。空になったら元の文字列にフォールバック
  const query = stripParenSuffix(rawQuery) || rawQuery;

  const seedRaw = searchParams.get("seed");
  const seed = seedRaw ? Math.max(1, Math.min(50, Number(seedRaw) || 1)) : 1;
  const useCache = seed === 1;

  const now = Date.now();
  if (useCache) {
    const cached = CACHE[query];
    if (cached && cached.expires > now) {
      return NextResponse.json({
        imageUrl: cached.url,
      } satisfies ImageResponse);
    }
  }

  // Try multiple Unsplash variants for better food/ingredient hits
  const isJapanese = /[ぁ-んァ-ヴー一-龠]/.test(query);
  const variants: string[] = [];
  if (isJapanese) {
    variants.push(`${query} food`);
    variants.push(query);
  } else {
    variants.push(query);
    variants.push(`${query} food`);
    variants.push(`${query} fresh ingredient`);
  }

  for (const v of variants) {
    const url = await fetchUnsplashImage(v, seed);
    if (url) {
      if (useCache) CACHE[query] = { url, expires: now + TTL_MS };
      return NextResponse.json({ imageUrl: url } satisfies ImageResponse);
    }
  }

  // Wikipedia fallback (seed の影響なし)
  const wiki = await fetchWikipediaImage(query);
  if (wiki) {
    if (useCache) CACHE[query] = { url: wiki, expires: now + TTL_MS };
    return NextResponse.json({ imageUrl: wiki } satisfies ImageResponse);
  }

  console.warn("image not found", { query, seed });
  return NextResponse.json({ imageUrl: null } satisfies ImageResponse);
}
