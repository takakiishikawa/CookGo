import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { CLAUDE_SONNET } from "@/lib/constants";
import { fetchOgImage } from "@/lib/og-image";

export const maxDuration = 60;

const client = new Anthropic();

interface RecommendRequest {
  query: string;
}

export interface RecipeRecommendation {
  title: string;
  url: string;
  summary: string;
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
- なるべく多様なサイト・調理法から選ぶ
- 信頼性の高い情報源を優先

最終回答は **JSON のみ**(コードブロック不要・前後の説明不要)で返してください:
{
  "recipes": [
    { "title": "料理名(日本語)", "url": "https://...", "summary": "1〜2文の概要" }
  ]
}`;

    const response = await client.beta.messages.create({
      model: CLAUDE_SONNET,
      max_tokens: 4096,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 5,
          user_location: { type: "approximate", country: "JP" },
        },
      ],
      messages: [{ role: "user", content: prompt }],
    });

    // 最後の text ブロックから JSON を抽出
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
      throw new Error("Claudeから JSON を抽出できませんでした");
    }

    const parsed = JSON.parse(match[0]) as {
      recipes?: Array<{ title?: unknown; url?: unknown; summary?: unknown }>;
    };
    const list = Array.isArray(parsed.recipes) ? parsed.recipes : [];
    const cleaned = list
      .map((r) => ({
        title: typeof r.title === "string" ? r.title.trim() : "",
        url: typeof r.url === "string" ? r.url.trim() : "",
        summary: typeof r.summary === "string" ? r.summary.trim() : "",
      }))
      .filter((r) => r.title && r.url.startsWith("http"));

    // 各 URL から og:image を並列取得（取得失敗時は null）
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
