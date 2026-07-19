import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET } from "@/lib/constants";
import { fetchRecipeThumbnail, isLikelyPhoto } from "@/lib/recipe-thumbnail";

const client = new Anthropic({ maxRetries: 0 });

export interface RecipeRecommendation {
  title: string;
  url: string;
  summary: string;
  features: string[];
  thumbnail: string | null;
}

/**
 * Claude web-search-backed recipe search. Shared by the (UI-orphaned but
 * kept for manual testing) /api/recipes/recommend endpoint and the Discover
 * feed's weekly refresh job.
 */
export async function searchRecipes(
  topic: string,
  count: number,
): Promise<RecipeRecommendation[]> {
  const prompt = `あなたは料理アシスタントです。日本語のレシピサイトを web 検索して、以下の条件に合うレシピを **${count}件** 推薦してください。

【ユーザーの条件】
${topic}

【検索のコツ】
- cookpad / クラシル / デリッシュキッチン / Nadia / 楽天レシピ / 個人ブログ / 料理研究家サイト 等から探す
- なるべく多様なサイト・調理法から選ぶ(同じサイトばかりにしない)
- ${count}件は **互いに違う特徴** を持つよう選定

【出力フォーマット】
最終回答は **JSON のみ**(コードブロック不要・前後の説明不要):
{
  "recipes": [
    {
      "title": "料理名(日本語)",
      "url": "https://...",
      "summary": "1〜2文の概要",
      "features": ["短いタグ1", "短いタグ2", "短いタグ3"],
      "image": "完成した料理そのものの写真URL(検索結果ページから見つかれば。ロゴ/バナー/広告画像は不可。見つからなければ null)"
    }
  ]
}

features の書き方(各レシピを **ぱっと見で差別化** するため):
- 2〜4個の短いタグ(各 8文字以内程度)
- 例: ["30分以内", "作り置き向き", "鶏胸肉メイン"], ["フライパン1つ", "甘辛だれ", "ご飯泥棒"], ["低温調理", "本格派", "週末向け"]
- 「美味しい」「簡単」など曖昧で全レシピに当てはまる語は禁止
- 調理時間 / 主材料 / 調理法 / シーン / 特殊技法 等から拾う`;

  const response = await client.beta.messages.create({
    model: CLAUDE_SONNET,
    max_tokens: 8192,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
        user_location: { type: "approximate", country: "JP" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  const fullText = response.content
    .map((c) => {
      if (c.type === "text" && typeof (c as { text?: unknown }).text === "string") {
        return (c as { text: string }).text;
      }
      return "";
    })
    .filter((s) => s.length > 0)
    .join("\n");

  const match = fullText.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error("searchRecipes: no JSON in response", {
      fullText: fullText.slice(0, 500),
    });
    throw new Error("Claudeから JSON を抽出できませんでした");
  }

  const parsed = JSON.parse(match[0]) as {
    recipes?: Array<{
      title?: unknown;
      url?: unknown;
      summary?: unknown;
      features?: unknown;
      image?: unknown;
    }>;
  };
  const list = Array.isArray(parsed.recipes) ? parsed.recipes : [];
  const cleaned = list
    .map((r) => ({
      title: typeof r.title === "string" ? r.title.trim() : "",
      url: typeof r.url === "string" ? r.url.trim() : "",
      summary: typeof r.summary === "string" ? r.summary.trim() : "",
      features: Array.isArray(r.features)
        ? r.features
            .filter((f): f is string => typeof f === "string")
            .map((f) => f.trim())
            .filter(Boolean)
            .slice(0, 4)
        : [],
      claudeImage: typeof r.image === "string" ? r.image.trim() : null,
    }))
    .filter((r) => r.title && r.url.startsWith("http"));

  // Claude が web 検索中に見つけた画像 URL を優先(サーバー側フェッチは
  // kurashiru / delishkitchen / Nadia 等、データセンター IP からの
  // アクセスを 404 でブロックするサイトが多く失敗しがちなため)。
  // 無ければ fetchRecipeThumbnail で改めてページを取得してフォールバック
  return Promise.all(
    cleaned.map(async ({ claudeImage, ...r }): Promise<RecipeRecommendation> => {
      const thumbnail = isLikelyPhoto(claudeImage)
        ? claudeImage
        : await fetchRecipeThumbnail(r.url);
      return { ...r, thumbnail };
    }),
  );
}
