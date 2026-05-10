import { NextResponse } from "next/server";
import { fetchUnsplashImage } from "@/lib/unsplash";
import type { ImageResponse } from "@/types/api";

const CACHE: Record<string, { url: string; expires: number }> = {};
const TTL_MS = 86_400_000; // 1 day

async function fetchWikipediaImage(query: string): Promise<string | null> {
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

/** `黒胡椒（サラダ用）` 等の括弧サフィックスは Unsplash で 0 件になるため除去 */
function stripParenSuffix(s: string): string {
  return s
    .replace(/[（(][^（()）]*[)）]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CATEGORY_FALLBACKS: Record<string, string> = {
  protein: "raw meat fish supermarket",
  vegetable: "fresh vegetables produce supermarket",
  carb: "rice noodles pasta package",
  seasoning: "condiment bottle supermarket shelf",
  other: "grocery food package",
};

function isJapanese(s: string): boolean {
  return /[ぁ-んァ-ヴー一-龠]/.test(s);
}

/** 1 つの query に対し supermarket 文脈の variant 候補を作る。
 *  陳列棚で複数商品が映った写真ではなく、"単品" にフォーカスした絵を狙う */
function supermarketVariants(query: string): string[] {
  if (isJapanese(query)) {
    return [
      `${query} 単品 パッケージ`,
      `${query} 商品 単体`,
      `${query} 食材 撮影`,
    ];
  }
  return [
    `${query} package isolated white background`,
    `${query} single product photo`,
    `${query} packaging close up`,
  ];
}

/** 1 つの query に対し汎用 variant 候補を作る */
function plainVariants(query: string): string[] {
  if (isJapanese(query)) {
    return [`${query} food`, query];
  }
  return [query, `${query} food`, `${query} fresh ingredient`];
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("query")?.trim();
  if (!rawQuery)
    return NextResponse.json({ imageUrl: null } satisfies ImageResponse);

  const query = stripParenSuffix(rawQuery) || rawQuery;
  // 日英フォールバック用のもう一方の名称(任意)
  const rawAlt = searchParams.get("queryAlt")?.trim() || null;
  const queryAlt = rawAlt ? stripParenSuffix(rawAlt) || rawAlt : null;

  const context = searchParams.get("context"); // "supermarket" | null
  const category = searchParams.get("category"); // protein/vegetable/...

  const seedRaw = searchParams.get("seed");
  const seed = seedRaw ? Math.max(1, Math.min(50, Number(seedRaw) || 1)) : 1;
  const useCache = seed === 1;

  // queryAlt も含めキャッシュキーを作る(同じ食材でも代替名違いで別画像のため)
  const cacheKey = [
    context ?? "default",
    query,
    queryAlt ?? "",
  ].join("|");

  const now = Date.now();
  if (useCache) {
    const cached = CACHE[cacheKey];
    if (cached && cached.expires > now) {
      return NextResponse.json({
        imageUrl: cached.url,
      } satisfies ImageResponse);
    }
  }

  // variant 構成: 日英両方を交互に試して取りこぼしを減らす
  const variants: string[] = [];
  if (context === "supermarket") {
    variants.push(...supermarketVariants(query));
    if (queryAlt) variants.push(...supermarketVariants(queryAlt));
  }
  variants.push(...plainVariants(query));
  if (queryAlt) variants.push(...plainVariants(queryAlt));
  // 重複排除
  const uniqueVariants = Array.from(new Set(variants));

  for (const v of uniqueVariants) {
    const url = await fetchUnsplashImage(v, seed);
    if (url) {
      if (useCache) CACHE[cacheKey] = { url, expires: now + TTL_MS };
      return NextResponse.json({ imageUrl: url } satisfies ImageResponse);
    }
  }

  // Wikipedia (seed の影響なし)
  const wiki = await fetchWikipediaImage(query);
  if (wiki) {
    if (useCache) CACHE[cacheKey] = { url: wiki, expires: now + TTL_MS };
    return NextResponse.json({ imageUrl: wiki } satisfies ImageResponse);
  }

  // カテゴリ代表画像 (空白を出さないため)。クエリ依存ではないのでキャッシュしない
  if (category && CATEGORY_FALLBACKS[category]) {
    const catUrl = await fetchUnsplashImage(CATEGORY_FALLBACKS[category], seed);
    if (catUrl) {
      return NextResponse.json({ imageUrl: catUrl } satisfies ImageResponse);
    }
  }

  console.warn("image not found", { query, queryAlt, seed, context, category });
  return NextResponse.json({ imageUrl: null } satisfies ImageResponse);
}
