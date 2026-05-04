/**
 * Unsplash で画像を1枚返す。
 * - 上位10件をまとめて取り、`seed` でその中の1枚を選ぶ
 *   （per_page=1 + page=N だと該当無しのクエリで全 page 空になり regenerate が機能しない）
 * - orientation 指定なし（IngredientThumb は object-cover の正方形描画でアス比不問）
 */
export async function fetchUnsplashImage(
  query: string,
  seed = 1,
): Promise<string | null> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return null;
  try {
    const safeSeed = Math.max(1, Math.floor(seed));
    const PER_PAGE = 10;
    const page = Math.floor((safeSeed - 1) / PER_PAGE) + 1;
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${PER_PAGE}&page=${page}`,
      { headers: { Authorization: `Client-ID ${key}` } },
    );
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        console.warn("unsplash rate limited", { query, status: res.status });
      }
      return null;
    }
    const data = (await res.json()) as {
      results?: Array<{ urls?: { regular?: string } }>;
    };
    const results = data.results ?? [];
    if (results.length === 0) return null;
    const idx = (safeSeed - 1) % results.length;
    return results[idx]?.urls?.regular ?? null;
  } catch {
    return null;
  }
}
