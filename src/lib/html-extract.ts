/**
 * HTML から Recipe 構造化用のテキストを抽出するヘルパー。
 * - schema.org/Recipe の JSON-LD があれば優先
 * - <title>, og:image, body の見出し / 段落を抜く
 */

export interface ExtractedHtml {
  title: string | null;
  ogImage: string | null;
  jsonLdRecipe: unknown | null;
  bodyText: string;
}

export function extractFromHtml(html: string): ExtractedHtml {
  return {
    title: extractTitle(html),
    ogImage: extractOgImage(html),
    jsonLdRecipe: extractJsonLdRecipe(html),
    bodyText: extractBodyText(html),
  };
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

export async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.9",
      },
      signal: AbortSignal.timeout(12_000),
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = await res.text();
    if (!html.trim()) return null;
    return html;
  } catch {
    return null;
  }
}
