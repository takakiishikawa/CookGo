import { extractFromHtml, fetchHtml } from "@/lib/html-extract";

/** ロゴ/バナー/広告である可能性が高い画像 URL を弾く簡易フィルタ */
const BAD_IMAGE_PATTERNS =
  /(^|[/_-])(logo|banner|ad|ads|advert|sprite|icon|placeholder|noimage|no-image|og-default|default[-_]?image)([/_.-]|$)/i;

export function isLikelyPhoto(url: string | null | undefined): url is string {
  if (!url) return false;
  if (/\.svg(\?|$)/i.test(url)) return false;
  if (BAD_IMAGE_PATTERNS.test(url)) return false;
  return true;
}

/**
 * レシピページの「料理そのものの写真」を取得する。
 * JSON-LD Recipe.image (最も信頼できる一次ソース) → og:image → twitter:image の順で
 * フォールバックし、ロゴ/バナーらしき URL は弾く。取得できなければ null
 * (呼び出し側でグラデーションのプレースホルダーにフォールバックする設計)。
 */
export async function fetchRecipeThumbnail(
  url: string,
): Promise<string | null> {
  const fetched = await fetchHtml(url);
  if (!fetched.ok || !fetched.html) {
    console.warn("fetchRecipeThumbnail: fetch failed", url, fetched.reason);
    return null;
  }

  const extracted = extractFromHtml(fetched.html);
  const candidates = [extracted.recipeImage, extracted.ogImage];

  for (const candidate of candidates) {
    if (isLikelyPhoto(candidate)) return resolveUrl(url, candidate);
  }
  console.warn("fetchRecipeThumbnail: no usable image", url, {
    recipeImage: extracted.recipeImage,
    ogImage: extracted.ogImage,
  });
  return null;
}

function resolveUrl(base: string, ref: string): string {
  try {
    return new URL(ref, base).toString();
  } catch {
    return ref;
  }
}
