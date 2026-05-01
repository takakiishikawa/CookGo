import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_SONNET } from "@/lib/constants";
import { fetchOgImage } from "@/lib/og-image";

export const maxDuration = 60;

const client = new Anthropic({ maxRetries: 0 });

interface RecommendRequest {
  query: string;
}

export interface RecipeRecommendation {
  title: string;
  url: string;
  summary: string;
  features: string[];
  thumbnail: string | null;
}

export interface RecipeRecommendResponse {
  recommendations: RecipeRecommendation[];
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { query } = (await request.json()) as RecommendRequest;
    const trimmed = (query ?? "").trim();
    if (!trimmed)
      return NextResponse.json(
        { error: "検索キーワードを入力してください" },
        { status: 400 },
      );

    const prompt = `あなたは料理アシスタントです。日本語のレシピサイトを web 検索して、以下の条件に合うレシピを **5件** 推薦してください。

【ユーザーの条件】
${trimmed}

【検索のコツ】
- cookpad / クラシル / デリッシュキッチン / Nadia / 楽天レシピ / 個人ブログ / 料理研究家サイト 等から探す
- なるべく多様なサイト・調理法から選ぶ(同じサイトばかりにしない)
- 5件は **互いに違う特徴** を持つよう選定

【出力フォーマット】
最終回答は **JSON のみ**(コードブロック不要・前後の説明不要):
{
  "recipes": [
    {
      "title": "料理名(日本語)",
      "url": "https://...",
      "summary": "1〜2文の概要",
      "features": ["短いタグ1", "短いタグ2", "短いタグ3"]
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
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 2,
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
      console.error("recommend: no JSON in response", { fullText: fullText.slice(0, 500) });
      throw new Error("Claudeから JSON を抽出できませんでした");
    }

    const parsed = JSON.parse(match[0]) as {
      recipes?: Array<{
        title?: unknown;
        url?: unknown;
        summary?: unknown;
        features?: unknown;
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
      }))
      .filter((r) => r.title && r.url.startsWith("http"));

    // 各 URL から og:image を並列取得(個別タイムアウトは og-image 内で 8 秒)
    const enriched = await Promise.all(
      cleaned.map(async (r): Promise<RecipeRecommendation> => {
        const thumbnail = await fetchOgImage(r.url);
        return { ...r, thumbnail };
      }),
    );

    return NextResponse.json({
      recommendations: enriched,
    } satisfies RecipeRecommendResponse);
  } catch (error) {
    console.error("recommend error:", error);
    const detail =
      error instanceof Error
        ? error.message
        : typeof error === "object" && error !== null
          ? JSON.stringify(error)
          : String(error);
    return NextResponse.json(
      { error: `レシピ検索に失敗しました: ${detail}` },
      { status: 500 },
    );
  }
}
