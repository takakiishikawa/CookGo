/**
 * HTML から Recipe 構造化用のテキストを抽出するヘルパー。
 * - schema.org/Recipe の JSON-LD があれば優先
 * - <title>, og:image, body の見出し / 段落を抜く
 */

export interface ExtractedHtml {
  title: string | null;
  ogImage: string | null;
  jsonLdRecipe: unknown | null;
  /** JSON-LD Recipe.image から抽出した、料理そのものの写真(最も信頼できる画像ソース) */
  recipeImage: string | null;
  /** JSON-LD の recipeInstructions[].image から抽出したステップ画像 URL の配列 (順序通り) */
  stepImages: string[];
  bodyText: string;
}

export function extractFromHtml(html: string): ExtractedHtml {
  const jsonLdRecipe = extractJsonLdRecipe(html);
  return {
    title: extractTitle(html),
    ogImage: extractOgImage(html),
    jsonLdRecipe,
    recipeImage: extractRecipeImage(jsonLdRecipe),
    stepImages: extractStepImagesFromJsonLd(jsonLdRecipe),
    bodyText: extractBodyText(html),
  };
}

/**
 * JSON-LD Recipe.image から料理写真の URL を取り出す。
 * サイトのロゴ/バナーになりがちな og:image より信頼できる一次ソース。
 * string / string[] / ImageObject / ImageObject[] のいずれの形にも対応。
 */
function extractRecipeImage(recipe: unknown): string | null {
  if (!recipe || typeof recipe !== "object") return null;
  const img = (recipe as Record<string, unknown>).image;
  return firstImageUrl(img);
}

function firstImageUrl(img: unknown): string | null {
  if (typeof img === "string") return img;
  if (Array.isArray(img)) {
    for (const item of img) {
      const url = firstImageUrl(item);
      if (url) return url;
    }
    return null;
  }
  if (img && typeof img === "object" && "url" in img) {
    const u = (img as { url?: unknown }).url;
    return typeof u === "string" ? u : null;
  }
  return null;
}

/**
 * JSON-LD Recipe.recipeInstructions から各ステップの image を取り出す。
 * recipeInstructions は string / HowToStep / HowToSection (steps を内包) のいずれか。
 */
function extractStepImagesFromJsonLd(recipe: unknown): string[] {
  if (!recipe || typeof recipe !== "object") return [];
  const obj = recipe as Record<string, unknown>;
  const instructions = obj.recipeInstructions;
  if (!Array.isArray(instructions)) return [];
  const out: string[] = [];
  for (const item of instructions) {
    if (!item || typeof item !== "object") {
      out.push("");
      continue;
    }
    const it = item as Record<string, unknown>;
    const t = it["@type"];
    if (
      t === "HowToSection" ||
      (Array.isArray(t) && t.includes("HowToSection"))
    ) {
      const inner = it.itemListElement;
      if (Array.isArray(inner)) {
        for (const s of inner) {
          out.push(extractImageFromInstructionItem(s));
        }
      }
    } else {
      out.push(extractImageFromInstructionItem(item));
    }
  }
  return out;
}

function extractImageFromInstructionItem(item: unknown): string {
  if (!item || typeof item !== "object") return "";
  const it = item as Record<string, unknown>;
  const img = it.image;
  if (typeof img === "string") return img;
  if (Array.isArray(img)) {
    const first = img.find(
      (x): x is string | { url?: string } =>
        typeof x === "string" || (typeof x === "object" && x !== null),
    );
    if (typeof first === "string") return first;
    if (first && typeof first === "object" && "url" in first) {
      const u = (first as { url?: unknown }).url;
      return typeof u === "string" ? u : "";
    }
  }
  if (img && typeof img === "object" && "url" in img) {
    const u = (img as { url?: unknown }).url;
    return typeof u === "string" ? u : "";
  }
  return "";
}

function extractTitle(html: string): string | null {
  const og = html.match(
    /<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i,
  );
  if (og?.[1]) return og[1];
  const t = html.match(/<title>([^<]+)<\/title>/i);
  return t?.[1]?.trim() ?? null;
}

function extractOgImage(html: string): string | null {
  const m1 = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  );
  if (m1?.[1]) return m1[1];
  const m2 = html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  );
  if (m2?.[1]) return m2[1];
  return null;
}

function extractJsonLdRecipe(html: string): unknown | null {
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const found = findRecipeNode(parsed);
      if (found) return found;
    } catch {
      // ignore malformed JSON-LD
    }
  }
  return null;
}

function findRecipeNode(node: unknown): unknown | null {
  if (!node) return null;
  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findRecipeNode(item);
      if (found) return found;
    }
    return null;
  }
  if (typeof node === "object") {
    const obj = node as Record<string, unknown>;
    const t = obj["@type"];
    if (
      t === "Recipe" ||
      (Array.isArray(t) && t.includes("Recipe"))
    ) {
      return obj;
    }
    if (Array.isArray(obj["@graph"])) {
      return findRecipeNode(obj["@graph"]);
    }
  }
  return null;
}

function extractBodyText(html: string): string {
  // 主要な要素タグから text を取り出す簡易抽出
  const main =
    html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1] ??
    html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1] ??
    html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1] ??
    html;

  const stripped = main
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

  return stripped.slice(0, 12_000);
}

export interface FetchHtmlResult {
  ok: boolean;
  html: string | null;
  /** 失敗理由（成功時は null）。422 レスポンスや観測のために返す */
  reason: string | null;
}

export async function fetchHtml(url: string): Promise<FetchHtmlResult> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9,ja;q=0.8",
        Referer: "https://www.google.com/",
        "Sec-Ch-Ua":
          '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"macOS"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "cross-site",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) {
      return { ok: false, html: null, reason: `http_${res.status}` };
    }
    const html = await res.text();
    if (!html.trim()) {
      return { ok: false, html: null, reason: "empty_body" };
    }
    return { ok: true, html, reason: null };
  } catch (error) {
    const name = error instanceof Error ? error.name : "unknown";
    return { ok: false, html: null, reason: `fetch_error_${name}` };
  }
}
